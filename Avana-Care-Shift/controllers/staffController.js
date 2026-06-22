const bcrypt = require('bcryptjs');
const { getDb } = require('../models/db');

function listStaff(req, res) {
  const db = getDb();
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ["u.role = 'staff'"];
  let params = [];

  if (search) {
    where.push("(u.username LIKE ? OR u.email LIKE ? OR sp.phone LIKE ? OR sp.skills LIKE ?)");
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as count FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE ${whereClause}`).get(...params);

  const staff = db.prepare(`
    SELECT u.id, u.username, u.email, u.avatar, u.status, u.created_at,
           sp.phone, sp.address, sp.skills, sp.qualifications, sp.rating, 
           sp.completed_shifts, sp.bio, sp.emergency_contact, sp.emergency_phone
    FROM users u
    LEFT JOIN staff_profiles sp ON u.id = sp.user_id
    WHERE ${whereClause}
    ORDER BY u.username
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    staff,
    pagination: {
      total: total.count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total.count / parseInt(limit))
    }
  });
}

function getStaff(req, res) {
  const db = getDb();
  const staffMember = db.prepare(`
    SELECT u.id, u.username, u.email, u.avatar, u.status, u.created_at,
           sp.*
    FROM users u
    LEFT JOIN staff_profiles sp ON u.id = sp.user_id
    WHERE u.id = ? AND u.role = 'staff'
  `).get(req.params.id);

  if (!staffMember) return res.status(404).json({ error: 'Staff member not found.' });

  const availability = db.prepare('SELECT * FROM staff_availability WHERE staff_id = ?').all(req.params.id);
  const recentShifts = db.prepare(`
    SELECT s.*, c.name as client_name FROM shifts s 
    LEFT JOIN clients c ON s.client_id = c.id 
    WHERE s.staff_id = ? ORDER BY s.date DESC LIMIT 10
  `).all(req.params.id);

  res.json({ staff: staffMember, availability, recentShifts });
}

function createStaff(req, res) {
  const { username, email, password, phone, address, skills, qualifications, bio } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'Username or email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)').run(username, email, hash, 'staff');
  const userId = result.lastInsertRowid;

  db.prepare('INSERT INTO staff_profiles (user_id, phone, address, skills, qualifications, bio) VALUES (?,?,?,?,?,?)').run(userId, phone || '', address || '', skills || '', qualifications || '', bio || '');

  const staff = db.prepare('SELECT u.id, u.username, u.email, u.role, u.status, sp.* FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = ?').get(userId);
  res.status(201).json(staff);
}

function updateStaff(req, res) {
  const { username, email, phone, address, skills, qualifications, bio, status, emergency_contact, emergency_phone } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(req.params.id, 'staff');
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' });

  if (username || email) {
    db.prepare('UPDATE users SET username=COALESCE(?,username), email=COALESCE(?,email), status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(username || null, email || null, status || null, req.params.id);
  }

  db.prepare(`
    UPDATE staff_profiles SET phone=?, address=?, skills=?, qualifications=?, bio=?, emergency_contact=?, emergency_phone=?
    WHERE user_id=?
  `).run(phone || '', address || '', skills || '', qualifications || '', bio || '', emergency_contact || '', emergency_phone || '', req.params.id);

  const staff = db.prepare('SELECT u.id, u.username, u.email, u.role, u.avatar, u.status, sp.* FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = ?').get(req.params.id);
  res.json(staff);
}

function deleteStaff(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(req.params.id, 'staff');
  if (result.changes === 0) return res.status(404).json({ error: 'Staff member not found.' });
  res.json({ message: 'Staff member deleted successfully.' });
}

function searchAvailableStaff(req, res) {
  const { day, time_slot } = req.query;
  const db = getDb();

  let where = ["u.role = 'staff'", "u.status = 'active'"];
  let params = [];

  if (day !== undefined) { where.push('sa.day_of_week = ?'); params.push(parseInt(day)); }
  if (time_slot) { where.push('sa.time_slot = ?'); params.push(time_slot); }
  if (day !== undefined || time_slot) { where.push('sa.is_active = 1'); }

  const joinAvail = (day !== undefined || time_slot) ? 'JOIN staff_availability sa ON u.id = sa.staff_id' : '';
  const whereClause = where.join(' AND ');

  const staff = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.email, u.avatar,
           sp.phone, sp.skills, sp.qualifications, sp.rating, sp.completed_shifts
    FROM users u
    LEFT JOIN staff_profiles sp ON u.id = sp.user_id
    ${joinAvail}
    WHERE ${whereClause}
    ORDER BY sp.rating DESC
  `).all(...params);

  res.json(staff);
}

module.exports = { listStaff, getStaff, createStaff, updateStaff, deleteStaff, searchAvailableStaff };
