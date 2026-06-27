const { query, queryOne, run } = require('../models/db');

async function getAvailability(req, res) {
  try {
    const staffId = req.params.staff_id || req.user.id;
    const availability = await query('SELECT * FROM staff_availability WHERE staff_id = ?', [staffId]);
    res.json(availability);
  } catch (err) {
    console.error('getAvailability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function setAvailability(req, res) {
  try {
    const { availability } = req.body;
    if (!availability || !Array.isArray(availability)) {
      return res.status(400).json({ error: 'Availability array is required.' });
    }

    const staffId = req.user.id;
    const { getDb } = require('../models/db');
    const pool = await getDb();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM staff_availability WHERE staff_id = ?', [staffId]);
      for (const item of availability) {
        await connection.execute(
          'INSERT INTO staff_availability (staff_id, day_of_week, time_slot, is_active) VALUES (?,?,?,?)',
          [staffId, item.day_of_week, item.time_slot, item.is_active !== false ? 1 : 0]
        );
      }
      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    const updated = await query('SELECT * FROM staff_availability WHERE staff_id = ?', [staffId]);
    res.json(updated);
  } catch (err) {
    console.error('setAvailability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getAvailability, setAvailability };
