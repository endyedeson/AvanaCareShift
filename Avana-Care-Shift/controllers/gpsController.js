const { query, queryOne, run } = require('../models/db');

async function logGPS(req, res) {
  try {
    const { shift_id, latitude, longitude, action } = req.body;
    if (!shift_id || !latitude || !longitude || !action) {
      return res.status(400).json({ error: 'Shift ID, latitude, longitude, and action are required.' });
    }

    const result = await run('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, action) VALUES (?,?,?,?,?)',
      [shift_id, req.user.id, latitude, longitude, action]);

    const log = await queryOne('SELECT * FROM gps_logs WHERE id = ?', [result.insertId]);
    res.status(201).json(log);
  } catch (err) {
    console.error('logGPS error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getGPSHistory(req, res) {
  try {
    const logs = await query('SELECT * FROM gps_logs WHERE shift_id = ? AND staff_id = ? ORDER BY timestamp', [req.params.shiftId, req.user.id]);

    if (logs.length === 0) {
      return res.json({ logs: [], route: null });
    }

    const route = logs.map(l => ({ lat: l.latitude, lng: l.longitude, time: l.timestamp, action: l.action }));
    res.json({ logs, route });
  } catch (err) {
    console.error('getGPSHistory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getGPSByShift(req, res) {
  try {
    const logs = await query('SELECT * FROM gps_logs WHERE shift_id = ? ORDER BY timestamp', [req.params.shiftId]);
    res.json(logs);
  } catch (err) {
    console.error('getGPSByShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { logGPS, getGPSHistory, getGPSByShift };
