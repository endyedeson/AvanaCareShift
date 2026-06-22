const bcrypt = require('bcryptjs');
const { getDb } = require('../models/db');
const { generateToken } = require('../middleware/auth');

function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = ?').get(username, 'active');
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = generateToken(user);
  const profile = getProfileData(db, user);
  const settings = getCompanySettings(db);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      profile
    },
    settings
  });
}

function registerClient(req, res) {
  const { username, email, password, name, phone, address } = req.body;
  if (!username || !email || !password || !name) {
    return res.status(400).json({ error: 'Username, email, password, and name are required.' });
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(username, email, hash, 'client');

  const userId = result.lastInsertRowid;
  db.prepare('INSERT INTO clients (user_id, name, phone, address) VALUES (?, ?, ?, ?)').run(userId, name, phone || '', address || '');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = generateToken(user);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
}

function getMe(req, res) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, role, avatar, status, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const profile = getProfileData(db, user);
  const settings = getCompanySettings(db);

  res.json({ user: { ...user, profile }, settings });
}

function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.user.id);

  res.json({ message: 'Password updated successfully.' });
}

function getProfileData(db, user) {
  if (user.role === 'staff') {
    const p = db.prepare('SELECT * FROM staff_profiles WHERE user_id = ?').get(user.id);
    if (p) {
      return {
        phone: p.phone,
        address: p.address,
        skills: p.skills,
        qualifications: p.qualifications,
        rating: p.rating,
        completed_shifts: p.completed_shifts,
        bio: p.bio,
        emergency_contact: p.emergency_contact,
        emergency_phone: p.emergency_phone
      };
    }
  } else if (user.role === 'client') {
    const c = db.prepare('SELECT * FROM clients WHERE user_id = ?').get(user.id);
    if (c) {
      return {
        name: c.name,
        phone: c.phone,
        address: c.address,
        emergency_contact: c.emergency_contact,
        emergency_phone: c.emergency_phone,
        medical_notes: c.medical_notes,
        preferred_caregiver_id: c.preferred_caregiver_id
      };
    }
  }
  return null;
}

function getCompanySettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

module.exports = { login, registerClient, getMe, changePassword };
