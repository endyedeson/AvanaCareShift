const { getDb } = require('../models/db');

function getSettings(req, res) {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
}

function updateSettings(req, res) {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required.' });
  }

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }
  });
  transaction();

  const updated = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of updated) {
    result[row.key] = row.value;
  }
  res.json(result);
}

function backupDatabase(req, res) {
  const { backupDb } = require('../models/db');
  try {
    const path = backupDb();
    res.json({ message: 'Backup created successfully.', path });
  } catch (err) {
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
}

function restoreDatabase(req, res) {
  const { backupPath } = req.body;
  if (!backupPath) return res.status(400).json({ error: 'Backup path is required.' });

  const { restoreDb } = require('../models/db');
  try {
    restoreDb(backupPath);
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
}

function listBackups(req, res) {
  const fs = require('fs');
  const path = require('path');
  const backupDir = path.join(__dirname, '..', 'database', 'backups');

  if (!fs.existsSync(backupDir)) {
    return res.json({ backups: [] });
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      size: fs.statSync(path.join(backupDir, f)).size,
      date: fs.statSync(path.join(backupDir, f)).mtime
    }))
    .sort((a, b) => b.date - a.date);

  res.json({ backups: files });
}

module.exports = { getSettings, updateSettings, backupDatabase, restoreDatabase, listBackups };
