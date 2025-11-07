require('dotenv').config();
const express = require('express');
const cors = require('cors');

// === IMPORT ROUTES ===
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const fileRoutes = require('./routes/file');

const app = express();

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// === PARSE SERVICE ACCOUNT SAFELY ===
let serviceAccount = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim().startsWith('{')) {
    serviceAccount = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Warning: Invalid FIREBASE_SERVICE_ACCOUNT in .env');
}

// === HEALTH CHECK ===
app.get('/', (req, res) => {
  res.json({
    message: 'CareerGuide Backend Running',
    timestamp: new Date().toISOString(),
    project: serviceAccount?.project_id || 'unknown',
    email: process.env.EMAIL_USER || 'not set',
    endpoints: {
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      avatar: 'POST /file/upload-avatar',
      document: 'POST /file/upload-document',
      deleteDoc: 'POST /file/delete-document',
    },
  });
});

// === MOUNT ROUTES ===
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/file', fileRoutes);

// === 404 HANDLER - CORRECTED ===
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'POST /auth/register',
      'POST /auth/login', 
      'POST /file/upload-avatar',
      'POST /file/upload-document',
      'POST /file/delete-document'
    ]
  });
});

// === ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// === START SERVER ===
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\nCareerGuide Backend LIVE`);
  console.log(`==============================`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Project: ${serviceAccount?.project_id || 'unknown'}`);
  console.log(`Email: ${process.env.EMAIL_USER || 'not set'}`);
  console.log(`Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==============================\n`);
});