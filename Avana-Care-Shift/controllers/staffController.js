const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../models/db');

async function listStaff(req, res) {
  try {
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
    const total = await queryOne(`SELECT COUNT(*) as count FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE ${whereClause}`, params);

    const staff = await query(`
      SELECT u.id, u.username, u.email, u.avatar, u.status, u.created_at,
             sp.phone, sp.address, sp.skills, sp.qualifications, sp.rating, 
             sp.completed_shifts, sp.bio, sp.emergency_contact, sp.emergency_phone
      FROM users u
      LEFT JOIN staff_profiles sp ON u.id = sp.user_id
      WHERE ${whereClause}
      ORDER BY u.username
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      staff,
      pagination: {
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.count / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('listStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getStaff(req, res) {
  try {
    const staffMember = await queryOne(`
      SELECT u.id, u.username, u.email, u.avatar, u.status, u.created_at,
             sp.*
      FROM users u
      LEFT JOIN staff_profiles sp ON u.id = sp.user_id
      WHERE u.id = ? AND u.role = 'staff'
    `, [req.params.id]);

    if (!staffMember) return res.status(404).json({ error: 'Staff member not found.' });

    const availability = await query('SELECT * FROM staff_availability WHERE staff_id = ?', [req.params.id]);
    const recentShifts = await query(`
      SELECT s.*, c.name as client_name FROM shifts s 
      LEFT JOIN clients c ON s.client_id = c.id 
      WHERE s.staff_id = ? ORDER BY s.date DESC LIMIT 10
    `, [req.params.id]);

    res.json({ staff: staffMember, availability, recentShifts });
  } catch (err) {
    console.error('getStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createStaff(req, res) {
  try {
    const { username, email, password, phone, address, skills, qualifications, bio } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) return res.status(409).json({ error: 'Username or email already exists.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)', [username, email, hash, 'staff']);
    const userId = result.insertId;

    await run('INSERT INTO staff_profiles (user_id, phone, address, skills, qualifications, bio) VALUES (?,?,?,?,?,?)',
      [userId, phone || '', address || '', skills || '', qualifications || '', bio || '']);

    const staff = await queryOne('SELECT u.id, u.username, u.email, u.role, u.status, sp.* FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = ?', [userId]);
    res.status(201).json(staff);
  } catch (err) {
    console.error('createStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateStaff(req, res) {
  try {
    const { username, email, phone, address, skills, qualifications, bio, status, emergency_contact, emergency_phone } = req.body;

    const existing = await queryOne('SELECT * FROM users WHERE id = ? AND role = ?', [req.params.id, 'staff']);
    if (!existing) return res.status(404).json({ error: 'Staff member not found.' });

    if (username || email) {
      await run('UPDATE users SET username=COALESCE(?,username), email=COALESCE(?,email), status=COALESCE(?,status) WHERE id=?',
        [username || null, email || null, status || null, req.params.id]);
    }

    await run(`
      UPDATE staff_profiles SET phone=?, address=?, skills=?, qualifications=?, bio=?, emergency_contact=?, emergency_phone=?
      WHERE user_id=?
    `, [phone || '', address || '', skills || '', qualifications || '', bio || '', emergency_contact || '', emergency_phone || '', req.params.id]);

    const staff = await queryOne('SELECT u.id, u.username, u.email, u.role, u.avatar, u.status, sp.* FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = ?', [req.params.id]);
    res.json(staff);
  } catch (err) {
    console.error('updateStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteStaff(req, res) {
  try {
    const result = await run('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'staff']);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Staff member not found.' });
    res.json({ message: 'Staff member deleted successfully.' });
  } catch (err) {
    console.error('deleteStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function searchAvailableStaff(req, res) {
  try {
    const { day, time_slot } = req.query;

    let where = ["u.role = 'staff'", "u.status = 'active'"];
    let params = [];

    if (day !== undefined) { where.push('sa.day_of_week = ?'); params.push(parseInt(day)); }
    if (time_slot) { where.push('sa.time_slot = ?'); params.push(time_slot); }
    if (day !== undefined || time_slot) { where.push('sa.is_active = 1'); }

    const joinAvail = (day !== undefined || time_slot) ? 'JOIN staff_availability sa ON u.id = sa.staff_id' : '';
    const whereClause = where.join(' AND ');

    const staff = await query(`
      SELECT DISTINCT u.id, u.username, u.email, u.avatar,
             sp.phone, sp.skills, sp.qualifications, sp.rating, sp.completed_shifts
      FROM users u
      LEFT JOIN staff_profiles sp ON u.id = sp.user_id
      ${joinAvail}
      WHERE ${whereClause}
      ORDER BY sp.rating DESC
    `, params);

    res.json(staff);
  } catch (err) {
    console.error('searchAvailableStaff error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listStaff, getStaff, createStaff, updateStaff, deleteStaff, searchAvailableStaff };
