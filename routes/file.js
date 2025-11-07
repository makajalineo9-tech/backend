// routes/file.js
const express = require('express');
const router = express.Router();
const { storage, db } = require('../config/firebase');
const { verifyFirebaseToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/upload-avatar', verifyFirebaseToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { uid } = req.user;
  const file = storage.bucket().file(`avatars/${uid}/profile.jpg`);

  try {
    await file.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '01-01-2030' });
    await db.collection('users').doc(uid).update({ avatar: url });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/upload-document', verifyFirebaseToken, upload.single('document'), async (req, res) => {
  if (!req.file || req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'PDF only' });
  }
  const { uid } = req.user;
  const fileName = `documents/${uid}/${Date.now()}-${req.file.originalname}`;
  const file = storage.bucket().file(fileName);

  try {
    await file.save(req.file.buffer, { metadata: { contentType: 'application/pdf' } });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '01-01-2030' });

    const newDoc = {
      id: Date.now().toString(),
      name: req.file.originalname,
      url,
      uploaded: new Date().toISOString().split('T')[0],
    };

    await db.collection('users').doc(uid).update({
      documents: admin.firestore.FieldValue.arrayUnion(newDoc),
    });

    res.json({ document: newDoc });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/delete-document', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.user;
  const { docId } = req.body;
  if (!docId) return res.status(400).json({ error: 'docId required' });

  const snap = await db.collection('users').doc(uid).get();
  const docs = snap.data().documents || [];
  const doc = docs.find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  await storage.bucket().file(`documents/${uid}/${docId}-${doc.name}`).delete().catch(() => {});
  const updated = docs.filter(d => d.id !== docId);
  await db.collection('users').doc(uid).update({ documents: updated });

  res.json({ success: true });
});

module.exports = router;