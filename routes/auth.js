// routes/auth.js
const express = require('express');
const router = express.Router();
const { db, auth, admin } = require('../config/firebase'); 
const { sendVerificationEmail } = require('../utils/email');
const fetch = require('node-fetch');

// -----------------------
// REGISTER
// -----------------------
router.post('/register', async (req, res) => {
  // SAFETY: Ensure body exists
  if (!req.body) {
    return res.status(400).json({ error: 'Request body is missing' });
  }

  const { email, password, fullName, role, phone, institutionName } = req.body;

  // Validation
  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Email, password, fullName, and role are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // 1. Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber: phone || null,
      emailVerified: false,
    });

    // 2. Save to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      fullName,
      role,
      phone: phone || '',
      institutionName: institutionName || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      emailVerified: false,
    });

    // 3. Generate verification link
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&role=${role}`,
      handleCodeInApp: true,
    };
    const verificationLink = await auth.generateEmailVerificationLink(email, actionCodeSettings);

    // 4. Send email
    const emailResult = await sendVerificationEmail(email, verificationLink, fullName, role);

    // 5. Response
    const response = {
      message: 'Account created! Please check your email to verify.',
      uid: userRecord.uid,
      role,
      emailSent: emailResult.success,
    };

    if (process.env.NODE_ENV === 'development') {
      response.verificationLink = verificationLink;
    }

    if (!emailResult.success) {
      response.note = 'Email failed to send. Contact support.';
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Register error:', error);
    if (error.code) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// -----------------------
// LOGIN
// -----------------------
router.post('/login', async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: 'Request body is missing' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    console.log('=== LOGIN ATTEMPT START ===');
    console.log('Email:', email);
    console.log('FIREBASE_API_KEY exists:', !!process.env.FIREBASE_API_KEY);
    console.log('FIREBASE_SERVICE_ACCOUNT exists:', !!process.env.FIREBASE_SERVICE_ACCOUNT);

    // 1. Call Firebase REST API
    const firebaseUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    console.log('Firebase Auth URL:', firebaseUrl);

    const resp = await fetch(firebaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await resp.json();
    console.log('Firebase Auth Response:', JSON.stringify(data, null, 2));

    if (data.error) {
      const msg = data.error.message === 'INVALID_LOGIN_CREDENTIALS'
        ? 'Invalid email or password'
        : data.error.message;
      return res.status(401).json({ error: msg });
    }

    const { localId: uid, idToken } = data;
    console.log('Firebase Auth Success - UID:', uid);

    // 2. Check email verification using Admin SDK
    console.log('Attempting to get user via Admin SDK...');
    try {
      const adminUser = await auth.getUser(uid);
      console.log('Admin SDK User Data:', {
        uid: adminUser.uid,
        email: adminUser.email,
        emailVerified: adminUser.emailVerified,
        displayName: adminUser.displayName
      });

      if (!adminUser.emailVerified) {
        return res.status(403).json({
          error: 'Please verify your email before logging in.',
        });
      }
    } catch (adminError) {
      console.error('Admin SDK Error:', adminError);
      throw new Error(`Admin SDK failed: ${adminError.message}`);
    }

    // 3. Get user from Firestore
    console.log('Fetching user from Firestore...');
    const userSnap = await db.collection('users').doc(uid).get();
    
    if (!userSnap.exists) {
      console.error('User not found in Firestore for UID:', uid);
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userSnap.data();
    console.log('Firestore User Data:', userData);

    // 4. Sync Firestore
    if (!userData.emailVerified) {
      console.log('Updating email verification in Firestore...');
      await db.collection('users').doc(uid).update({
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 5. Success
    console.log('=== LOGIN SUCCESSFUL ===');
    res.json({
      message: 'Login successful!',
      uid,
      role: userData.role,
      token: idToken,
      user: {
        email: userData.email,
        fullName: userData.fullName,
        phone: userData.phone,
        institutionName: userData.institutionName,
        emailVerified: true,
      },
    });

  } catch (error) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Login failed. Please try again.',
      // Include details for debugging in development
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack
      })
    });
  }
  // -----------------------
// VERIFY EMAIL (OOB Code)
// -----------------------
router.post('/verify-email', async (req, res) => {
  const { oobCode } = req.body;

  if (!oobCode) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  try {
    // 1. Apply the OOB code
    const email = await auth.applyActionCode(oobCode);

    // 2. Get user by email
    const userRecord = await auth.getUserByEmail(email);

    // 3. Update Firestore
    await db.collection('users').doc(userRecord.uid).update({
      emailVerified: true,
      emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Email verified for: ${email} (UID: ${userRecord.uid})`);

    res.json({
      message: 'Email verified successfully!',
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error) {
    console.error('Email verification error:', error);

    // Common Firebase errors
    const errorMessages = {
      'auth/expired-action-code': 'Verification link has expired. Please request a new one.',
      'auth/invalid-action-code': 'Invalid or already used verification link.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found for this email.',
    };

    const message = errorMessages[error.code] || 'Email verification failed.';
    res.status(400).json({ error: message });
  }
});


});
module.exports = router;