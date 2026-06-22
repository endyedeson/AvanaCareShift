const bcrypt = require('bcryptjs');
const { getDb } = require('../models/db');

function listClients(req, res) {
  const db = getDb();
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  let params = [];

  if (search) {
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ? OR u.email LIKE ?)");
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as count FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE ${whereClause}`).get(...params);

  const clients = db.prepare(`
    SELECT c.*, u.username, u.email, u.status, u.avatar, u.created_at,
           (SELECT username FROM users WHERE id = c.preferred_caregiver_id) as preferred_caregiver_name
    FROM clients c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE ${whereClause}
    ORDER BY c.name
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ clients, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
}

function getClient(req, res) {
  const db = getDb();
  const client = db.prepare(`
    SELECT c.*, u.username, u.email, u.status, u.avatar, u.created_at
    FROM clients c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!client) return res.status(404).json({ error: 'Client not found.' });

  const recentShifts = db.prepare(`
    SELECT s.*, u.username as staff_name FROM shifts s 
    LEFT JOIN users u ON s.staff_id = u.id 
    WHERE s.client_id = ? ORDER BY s.date DESC LIMIT 10
  `).all(req.params.id);

  const invoices = db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id);

  res.json({ client, recentShifts, invoices });
}

function createClient(req, res) {
  const { name, username, email, password, phone, address, emergency_contact, emergency_phone, medical_notes } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email, and password are required.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'Username or email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)').run(username, email, hash, 'client');
  const userId = result.lastInsertRowid;

  db.prepare('INSERT INTO clients (user_id, name, phone, address, emergency_contact, emergency_phone, medical_notes) VALUES (?,?,?,?,?,?,?)')
    .run(userId, name, phone || '', address || '', emergency_contact || '', emergency_phone || '', medical_notes || '');

  const client = db.prepare('SELECT c.*, u.username, u.email FROM clients c JOIN users u ON c.user_id = u.id WHERE c.user_id = ?').get(userId);
  res.status(201).json(client);
}

function updateClient(req, res) {
  const { name, phone, address, emergency_contact, emergency_phone, medical_notes, preferred_caregiver_id, status, notes } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found.' });

  db.prepare(`
    UPDATE clients SET name=?, phone=?, address=?, emergency_contact=?, emergency_phone=?, 
    medical_notes=?, preferred_caregiver_id=?, notes=?
    WHERE id=?
  `).run(
    name || existing.name, 
    phone !== undefined ? phone : existing.phone,
    address !== undefined ? address : existing.address,
    emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
    emergency_phone !== undefined ? emergency_phone : existing.emergency_phone,
    medical_notes !== undefined ? medical_notes : existing.medical_notes,
    preferred_caregiver_id !== undefined ? preferred_caregiver_id : existing.preferred_caregiver_id,
    notes !== undefined ? notes : existing.notes,
    req.params.id
  );

  if (status) {
    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, existing.user_id);
  }

  const client = db.prepare('SELECT c.*, u.username, u.email, u.status FROM clients c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(req.params.id);
  res.json(client);
}

function deleteClient(req, res) {
  const db = getDb();
  const client = db.prepare('SELECT user_id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(client.user_id);
  res.json({ message: 'Client deleted successfully.' });
}

module.exports = { listClients, getClient, createClient, updateClient, deleteClient };
