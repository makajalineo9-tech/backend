// routes/user.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyFirebaseToken } = require('../middleware/auth');

router.get('/:uid', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.params;
  if (req.user.uid !== uid) return res.status(403).json({ error: 'Unauthorized' });

  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return res.status(404).json({ error: 'Not found' });

  res.json({ uid, ...snap.data() });
});

router.put('/:uid', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.params;
  if (req.user.uid !== uid) return res.status(403).json({ error: 'Unauthorized' });

  await db.collection('users').doc(uid).update({
    ...req.body,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.json({ message: 'Updated' });
});

module.exports = router;