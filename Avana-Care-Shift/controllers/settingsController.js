const { query, queryOne, run } = require('../models/db');

async function getSettings(req, res) {
  try {
    const rows = await query('SELECT `key`, value FROM settings');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateSettings(req, res) {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required.' });
    }

    const { getDb } = require('../models/db');
    const pool = await getDb();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [key, value] of Object.entries(settings)) {
        await connection.execute(
          'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
          [key, String(value)]
        );
      }
      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    const updated = await query('SELECT `key`, value FROM settings');
    const result = {};
    for (const row of updated) {
      result[row.key] = row.value;
    }
    res.json(result);
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

function backupDatabase(req, res) {
  res.json({ message: 'Backup functionality is not available with MySQL. Use your hosting provider backup tools or mysqldump.' });
}

function restoreDatabase(req, res) {
  res.status(400).json({ error: 'Restore functionality is not available with MySQL. Use your hosting provider restore tools or mysql CLI.' });
}

function listBackups(req, res) {
  res.json({ backups: [] });
}

module.exports = { getSettings, updateSettings, backupDatabase, restoreDatabase, listBackups };
