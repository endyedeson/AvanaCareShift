const bcrypt = require('bcryptjs');
const { query, queryOne, run } = require('../models/db');

async function listClients(req, res) {
  try {
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
    const total = await queryOne(`SELECT COUNT(*) as count FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE ${whereClause}`, params);

    const clients = await query(`
      SELECT c.*, u.username, u.email, u.status, u.avatar, u.created_at,
             (SELECT username FROM users WHERE id = c.preferred_caregiver_id) as preferred_caregiver_name
      FROM clients c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE ${whereClause}
      ORDER BY c.name
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({ clients, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
  } catch (err) {
    console.error('listClients error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getClient(req, res) {
  try {
    const client = await queryOne(`
      SELECT c.*, u.username, u.email, u.status, u.avatar, u.created_at
      FROM clients c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const recentShifts = await query(`
      SELECT s.*, u.username as staff_name FROM shifts s 
      LEFT JOIN users u ON s.staff_id = u.id 
      WHERE s.client_id = ? ORDER BY s.date DESC LIMIT 10
    `, [req.params.id]);

    const invoices = await query('SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);

    res.json({ client, recentShifts, invoices });
  } catch (err) {
    console.error('getClient error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createClient(req, res) {
  try {
    const { name, username, email, password, phone, address, emergency_contact, emergency_phone, medical_notes } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required.' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) return res.status(409).json({ error: 'Username or email already exists.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await run('INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)', [username, email, hash, 'client']);
    const userId = result.insertId;

    await run('INSERT INTO clients (user_id, name, phone, address, emergency_contact, emergency_phone, medical_notes) VALUES (?,?,?,?,?,?,?)',
      [userId, name, phone || '', address || '', emergency_contact || '', emergency_phone || '', medical_notes || '']);

    const client = await queryOne('SELECT c.*, u.username, u.email FROM clients c JOIN users u ON c.user_id = u.id WHERE c.user_id = ?', [userId]);
    res.status(201).json(client);
  } catch (err) {
    console.error('createClient error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateClient(req, res) {
  try {
    const { name, phone, address, emergency_contact, emergency_phone, medical_notes, preferred_caregiver_id, status, notes } = req.body;

    const existing = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client not found.' });

    await run(`
      UPDATE clients SET name=?, phone=?, address=?, emergency_contact=?, emergency_phone=?, 
      medical_notes=?, preferred_caregiver_id=?, notes=?
      WHERE id=?
    `, [
      name || existing.name,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
      emergency_phone !== undefined ? emergency_phone : existing.emergency_phone,
      medical_notes !== undefined ? medical_notes : existing.medical_notes,
      preferred_caregiver_id !== undefined ? preferred_caregiver_id : existing.preferred_caregiver_id,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    ]);

    if (status) {
      await run('UPDATE users SET status = ? WHERE id = ?', [status, existing.user_id]);
    }

    const client = await queryOne('SELECT c.*, u.username, u.email, u.status FROM clients c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [req.params.id]);
    res.json(client);
  } catch (err) {
    console.error('updateClient error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteClient(req, res) {
  try {
    const client = await queryOne('SELECT user_id FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    await run('DELETE FROM users WHERE id = ?', [client.user_id]);
    res.json({ message: 'Client deleted successfully.' });
  } catch (err) {
    console.error('deleteClient error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listClients, getClient, createClient, updateClient, deleteClient };
