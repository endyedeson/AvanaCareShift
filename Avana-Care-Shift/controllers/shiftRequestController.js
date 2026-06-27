const { query, queryOne, run } = require('../models/db');
const { createNotification } = require('../models/notifications');

async function listShiftRequests(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'client') {
      const client = await queryOne('SELECT id FROM clients WHERE user_id = ?', [req.user.id]);
      if (client) { where.push('sr.client_id = ?'); params.push(client.id); }
    }

    if (status) { where.push('sr.status = ?'); params.push(status); }

    const whereClause = where.join(' AND ');
    const total = await queryOne(`SELECT COUNT(*) as count FROM shift_requests sr WHERE ${whereClause}`, params);

    const requests = await query(`
      SELECT sr.*, u.username as preferred_staff_name
      FROM shift_requests sr
      LEFT JOIN users u ON sr.preferred_staff_id = u.id
      WHERE ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({ requests, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
  } catch (err) {
    console.error('listShiftRequests error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createShiftRequest(req, res) {
  try {
    const { client_name, phone, address, date, time, duration, care_type, notes } = req.body;
    if (!client_name || !date || !time) {
      return res.status(400).json({ error: 'Client name, date, and time are required.' });
    }

    let clientId = null;

    if (req.user.role === 'client') {
      const client = await queryOne('SELECT id FROM clients WHERE user_id = ?', [req.user.id]);
      if (client) clientId = client.id;
    }

    const result = await run(`
      INSERT INTO shift_requests (client_id, preferred_staff_id, client_name, phone, address, date, time, duration, care_type, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [clientId, req.body.preferred_staff_id || null, client_name, phone || '', address || '', date, time, duration || 0, care_type || '', notes || '']);

    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of admins) {
      await createNotification(admin.id, 'New Client Request', `${client_name} has submitted a new ${care_type} request for ${date}.`, 'warning', '/shift-requests');
    }

    const request = await queryOne('SELECT * FROM shift_requests WHERE id = ?', [result.insertId]);
    res.status(201).json(request);
  } catch (err) {
    console.error('createShiftRequest error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateShiftRequest(req, res) {
  try {
    const { status, preferred_staff_id } = req.body;

    const existing = await queryOne('SELECT * FROM shift_requests WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Shift request not found.' });

    await run('UPDATE shift_requests SET status=COALESCE(?,status), preferred_staff_id=COALESCE(?,preferred_staff_id) WHERE id=?',
      [status || null, preferred_staff_id !== undefined ? preferred_staff_id : null, req.params.id]);

    if (status === 'approved') {
      const clientId = existing.client_id;
      await run(`
        INSERT INTO shifts (client_id, staff_id, date, start_time, end_time, location, service_type, hours, notes, status, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,'open',?)
      `, [clientId, existing.preferred_staff_id || null, existing.date, existing.time, existing.time, existing.address, existing.care_type, existing.duration, existing.notes, req.user.id]);

      if (existing.preferred_staff_id) {
        await createNotification(existing.preferred_staff_id, 'Shift Request Approved', `A shift request from ${existing.client_name} has been approved.`, 'success', '/shifts');
      }
    }

    const updated = await queryOne('SELECT * FROM shift_requests WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('updateShiftRequest error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listShiftRequests, createShiftRequest, updateShiftRequest };
