const { getDb } = require('../models/db');
const { createNotification } = require('../models/notifications');

function listShiftRequests(req, res) {
  const db = getDb();
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'client') {
    const client = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(req.user.id);
    if (client) { where.push('sr.client_id = ?'); params.push(client.id); }
  }

  if (status) { where.push('sr.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as count FROM shift_requests sr WHERE ${whereClause}`).get(...params);

  const requests = db.prepare(`
    SELECT sr.*, u.username as preferred_staff_name
    FROM shift_requests sr
    LEFT JOIN users u ON sr.preferred_staff_id = u.id
    WHERE ${whereClause}
    ORDER BY sr.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ requests, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
}

function createShiftRequest(req, res) {
  const { client_name, phone, address, date, time, duration, care_type, notes } = req.body;
  if (!client_name || !date || !time) {
    return res.status(400).json({ error: 'Client name, date, and time are required.' });
  }

  const db = getDb();
  let clientId = null;

  if (req.user.role === 'client') {
    const client = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(req.user.id);
    if (client) clientId = client.id;
  }

  const result = db.prepare(`
    INSERT INTO shift_requests (client_id, preferred_staff_id, client_name, phone, address, date, time, duration, care_type, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(clientId, req.body.preferred_staff_id || null, client_name, phone || '', address || '', date, time, duration || 0, care_type || '', notes || '');

  // Notify all admin users
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  for (const admin of admins) {
    createNotification(admin.id, 'New Client Request', `${client_name} has submitted a new ${care_type} request for ${date}.`, 'warning', '/shift-requests');
  }

  const request = db.prepare('SELECT * FROM shift_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(request);
}

function updateShiftRequest(req, res) {
  const { status, preferred_staff_id } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM shift_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shift request not found.' });

  db.prepare('UPDATE shift_requests SET status=COALESCE(?,status), preferred_staff_id=COALESCE(?,preferred_staff_id), updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status || null, preferred_staff_id !== undefined ? preferred_staff_id : null, req.params.id);

  // If approved, create a shift
  if (status === 'approved') {
    const client = db.prepare('SELECT id FROM clients WHERE user_id = (SELECT user_id FROM clients WHERE id = ?)').get(existing.client_id);
    if (client || existing.client_id) {
      const clientId = existing.client_id;
      db.prepare(`
        INSERT INTO shifts (client_id, staff_id, date, start_time, end_time, location, service_type, hours, notes, status, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,'open',?)
      `).run(clientId, existing.preferred_staff_id || null, existing.date, existing.time, existing.time, existing.address, existing.care_type, existing.duration, existing.notes, req.user.id);
    }

    if (existing.preferred_staff_id) {
      createNotification(existing.preferred_staff_id, 'Shift Request Approved', `A shift request from ${existing.client_name} has been approved.`, 'success', '/shifts');
    }
  }

  const updated = db.prepare('SELECT * FROM shift_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
}

module.exports = { listShiftRequests, createShiftRequest, updateShiftRequest };
