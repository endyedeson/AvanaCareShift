const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../models/db');
const { generateToken } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    const profile = await getProfileData(user);
    const settings = await getCompanySettings();

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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function registerClient(req, res) {
  try {
    const { username, email, password, name, phone, address } = req.body;
    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'Username, email, password, and name are required.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', [username, email, hash, 'client']);

    const userId = result.insertId;
    await run('INSERT INTO clients (user_id, name, phone, address) VALUES (?, ?, ?, ?)', [userId, name, phone || '', address || '']);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
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
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getMe(req, res) {
  try {
    const user = await queryOne('SELECT id, username, email, role, avatar, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const profile = await getProfileData(user);
    const settings = await getCompanySettings();

    res.json({ user: { ...user, profile }, settings });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getProfileData(user) {
  if (user.role === 'staff') {
    const p = await queryOne('SELECT * FROM staff_profiles WHERE user_id = ?', [user.id]);
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
    const c = await queryOne('SELECT * FROM clients WHERE user_id = ?', [user.id]);
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

async function getCompanySettings() {
  const rows = await query('SELECT `key`, value FROM settings');
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

module.exports = { login, registerClient, getMe, changePassword };
