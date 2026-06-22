const { getDb } = require('../models/db');

function getAvailability(req, res) {
  const db = getDb();
  const staffId = req.params.staff_id || req.user.id;
  const availability = db.prepare('SELECT * FROM staff_availability WHERE staff_id = ?').all(staffId);
  res.json(availability);
}

function setAvailability(req, res) {
  const { availability } = req.body;
  if (!availability || !Array.isArray(availability)) {
    return res.status(400).json({ error: 'Availability array is required.' });
  }

  const db = getDb();
  const staffId = req.user.id;

  const deleteStmt = db.prepare('DELETE FROM staff_availability WHERE staff_id = ?');
  const insertStmt = db.prepare('INSERT INTO staff_availability (staff_id, day_of_week, time_slot, is_active) VALUES (?,?,?,?)');

  const transaction = db.transaction(() => {
    deleteStmt.run(staffId);
    for (const item of availability) {
      insertStmt.run(staffId, item.day_of_week, item.time_slot, item.is_active !== false ? 1 : 0);
    }
  });
  transaction();

  const updated = db.prepare('SELECT * FROM staff_availability WHERE staff_id = ?').all(staffId);
  res.json(updated);
}

module.exports = { getAvailability, setAvailability };
