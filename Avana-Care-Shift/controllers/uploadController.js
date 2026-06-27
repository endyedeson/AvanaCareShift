const { run } = require('../models/db');
const { uploadProfile, uploadLogo } = require('../middleware/upload');

async function uploadAndProcessProfilePic(req, res) {
  uploadProfile(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const url = `/uploads/profiles/${req.file.filename}`;
      await run('UPDATE users SET avatar = ? WHERE id = ?', [url, req.user.id]);
      res.json({ message: 'Profile picture uploaded.', url });
    } catch (dbErr) {
      res.status(500).json({ error: 'Upload processing failed.' });
    }
  });
}

async function uploadCompanyLogo(req, res) {
  uploadLogo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
      const url = `/uploads/logos/${req.file.filename}`;
      await run("UPDATE settings SET value = ? WHERE `key` = 'company_logo'", [url]);
      res.json({ message: 'Logo uploaded successfully.', url });
    } catch (dbErr) {
      res.status(500).json({ error: 'Upload processing failed.' });
    }
  });
}

module.exports = { uploadAndProcessProfilePic, uploadCompanyLogo };
