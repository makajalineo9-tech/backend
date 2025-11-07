// config/firebase.js
const admin = require('firebase-admin');
require('dotenv').config();

let serviceAccount;

try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not set in .env');
  }

  // If it starts with {, it's JSON string
  if (raw.trim().startsWith('{')) {
    serviceAccount = JSON.parse(raw);
  } else {
    // Otherwise, it's a file path
    serviceAccount = require(raw);
  }
} catch (err) {
  console.error('Failed to load Firebase service account:');
  console.error('   → Make sure FIREBASE_SERVICE_ACCOUNT is valid JSON string in .env');
  console.error('   → Or a correct path to .json file');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = { db, auth, storage, admin };