const { getDb } = require('../models/db');

function listAttendance(req, res) {
  const db = getDb();
  const { staff_id, date_from, date_to, status, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'staff') { where.push('a.staff_id = ?'); params.push(req.user.id); }
  if (staff_id) { where.push('a.staff_id = ?'); params.push(staff_id); }
  if (date_from) { where.push('a.date >= ?'); params.push(date_from); }
  if (date_to) { where.push('a.date <= ?'); params.push(date_to); }
  if (status) { where.push('a.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as count FROM attendance a WHERE ${whereClause}`).get(...params);

  const records = db.prepare(`
    SELECT a.*, u.username as staff_name, u.avatar as staff_avatar,
           s.service_type, s.client_id, c.name as client_name
    FROM attendance a
    JOIN users u ON a.staff_id = u.id
    LEFT JOIN shifts s ON a.shift_id = s.id
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE ${whereClause}
    ORDER BY a.date DESC, a.clock_in DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ records, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
}

function clockIn(req, res) {
  const { shift_id, date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required.' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM attendance WHERE staff_id = ? AND date = ? AND clock_out IS NULL').get(req.user.id, date);
  if (existing) return res.status(400).json({ error: 'Already clocked in for this date.' });

  const result = db.prepare('INSERT INTO attendance (shift_id, staff_id, clock_in, date) VALUES (?,?,?,?)')
    .run(shift_id || null, req.user.id, new Date().toISOString(), date);

  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(record);
}

function clockOut(req, res) {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required.' });

  const db = getDb();
  const record = db.prepare('SELECT * FROM attendance WHERE staff_id = ? AND date = ? AND clock_out IS NULL').get(req.user.id, date);
  if (!record) return res.status(404).json({ error: 'No active clock-in found for this date.' });

  const now = new Date();
  const clockIn = new Date(record.clock_in);
  const hoursWorked = Math.round((now - clockIn) / (1000 * 60 * 60) * 100) / 100;
  const lateMinutes = 0; // simplified

  db.prepare('UPDATE attendance SET clock_out=?, hours_worked=?, status=? WHERE id=?')
    .run(now.toISOString(), hoursWorked, hoursWorked > 0 ? 'present' : 'absent', record.id);

  const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id);
  res.json(updated);
}

function getMyAttendance(req, res) {
  const db = getDb();
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();
  const monthStr = `${y}-${String(m).padStart(2, '0')}`;

  const records = db.prepare(`
    SELECT a.*, s.service_type, c.name as client_name
    FROM attendance a
    LEFT JOIN shifts s ON a.shift_id = s.id
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE a.staff_id = ? AND a.date LIKE ?
    ORDER BY a.date
  `).all(req.user.id, `${monthStr}%`);

  const summary = db.prepare(`
    SELECT COUNT(*) as total_days, COALESCE(SUM(hours_worked),0) as total_hours,
           SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late_days,
           SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent_days,
           COALESCE(SUM(overtime),0) as total_overtime
    FROM attendance WHERE staff_id = ? AND date LIKE ?
  `).get(req.user.id, `${monthStr}%`);

  res.json({ records, summary });
}

module.exports = { listAttendance, clockIn, clockOut, getMyAttendance };
