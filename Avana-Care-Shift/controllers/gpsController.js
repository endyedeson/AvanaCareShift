const { getDb } = require('../models/db');

function logGPS(req, res) {
  const { shift_id, latitude, longitude, action } = req.body;
  if (!shift_id || !latitude || !longitude || !action) {
    return res.status(400).json({ error: 'Shift ID, latitude, longitude, and action are required.' });
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, action) VALUES (?,?,?,?,?)')
    .run(shift_id, req.user.id, latitude, longitude, action);

  const log = db.prepare('SELECT * FROM gps_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(log);
}

function getGPSHistory(req, res) {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM gps_logs WHERE shift_id = ? AND staff_id = ? ORDER BY timestamp').all(req.params.shiftId, req.user.id);

  if (logs.length === 0) {
    return res.json({ logs: [], route: null });
  }

  const route = logs.map(l => ({ lat: l.latitude, lng: l.longitude, time: l.timestamp, action: l.action }));
  res.json({ logs, route });
}

function getGPSByShift(req, res) {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM gps_logs WHERE shift_id = ? ORDER BY timestamp').all(req.params.shiftId);
  res.json(logs);
}

module.exports = { logGPS, getGPSHistory, getGPSByShift };
