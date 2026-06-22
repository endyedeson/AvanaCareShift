const path = require('path');
const fs = require('fs');
const { getDb } = require('../models/db');
const { uploadProfile, uploadLogo, handleUpload } = require('../middleware/upload');

function uploadAndProcessProfilePic(req, res) {
  uploadProfile(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const db = getDb();
      const url = `/uploads/profiles/${req.file.filename}`;
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
      res.json({ message: 'Profile picture uploaded.', url });
    } catch (sharpErr) {
      res.status(500).json({ error: 'Upload processing failed.' });
    }
  });
}

function uploadCompanyLogo(req, res) {
  uploadLogo(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const db = getDb();
    const url = `/uploads/logos/${req.file.filename}`;
    db.prepare("UPDATE settings SET value = ? WHERE key = 'company_logo'").run(url);

    res.json({ message: 'Logo uploaded successfully.', url });
  });
}

module.exports = { uploadAndProcessProfilePic, uploadCompanyLogo };
