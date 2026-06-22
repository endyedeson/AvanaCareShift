const { getDb } = require('../models/db');
const { createNotification } = require('../models/notifications');

function listShifts(req, res) {
  const db = getDb();
  const { status, staff_id, client_id, date_from, date_to, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['1=1'];
  let params = [];

  if (status) { where.push('s.status = ?'); params.push(status); }
  if (staff_id) { where.push('s.staff_id = ?'); params.push(staff_id); }
  if (client_id) { where.push('s.client_id = ?'); params.push(client_id); }
  if (date_from) { where.push('s.date >= ?'); params.push(date_from); }
  if (date_to) { where.push('s.date <= ?'); params.push(date_to); }
  if (search) {
    where.push("(c.name LIKE ? OR u.username LIKE ? OR s.location LIKE ? OR s.service_type LIKE ?)");
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) as count FROM shifts s LEFT JOIN clients c ON s.client_id = c.id LEFT JOIN users u ON s.staff_id = u.id WHERE ${whereClause}`).get(...params);

  const shifts = db.prepare(`
    SELECT s.*, c.name as client_name, c.address as client_address, 
           u.username as staff_name, u.avatar as staff_avatar,
           cr.username as created_by_name
    FROM shifts s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.staff_id = u.id
    LEFT JOIN users cr ON s.created_by = cr.id
    WHERE ${whereClause}
    ORDER BY s.date DESC, s.start_time
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    shifts,
    pagination: {
      total: total.count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total.count / parseInt(limit))
    }
  });
}

function getShift(req, res) {
  const db = getDb();
  const shift = db.prepare(`
    SELECT s.*, c.name as client_name, c.address as client_address, c.phone as client_phone,
           u.username as staff_name, u.avatar as staff_avatar,
           sp.phone as staff_phone, sp.skills as staff_skills
    FROM shifts s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.staff_id = u.id
    LEFT JOIN staff_profiles sp ON s.staff_id = sp.user_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!shift) return res.status(404).json({ error: 'Shift not found.' });

  const gpsLogs = db.prepare('SELECT * FROM gps_logs WHERE shift_id = ? ORDER BY timestamp').all(req.params.id);
  const attendance = db.prepare('SELECT * FROM attendance WHERE shift_id = ?').get(req.params.id);

  res.json({ shift, gpsLogs, attendance });
}

function createShift(req, res) {
  const { client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status } = req.body;
  if (!client_id || !date || !start_time || !end_time || !service_type) {
    return res.status(400).json({ error: 'Client, date, start time, end time, and service type are required.' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO shifts (client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, date, start_time, end_time, location || '', service_type, hours || 0, hourly_rate || 0, notes || '', status || 'open', req.user.id);

  const shiftId = result.lastInsertRowid;

  // Notify staff about new open shift
  if (status === 'open' || !status) {
    const staffUsers = db.prepare("SELECT id FROM users WHERE role = 'staff' AND status = 'active'").all();
    for (const staff of staffUsers) {
      createNotification(staff.id, 'New Shift Available', `A new ${service_type} shift has been posted for ${date}.`, 'info', `/shifts`);
    }
  }

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  res.status(201).json(shift);
}

function updateShift(req, res) {
  const { client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shift not found.' });

  db.prepare(`
    UPDATE shifts SET client_id=?, date=?, start_time=?, end_time=?, location=?, 
    service_type=?, hours=?, hourly_rate=?, notes=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    client_id || existing.client_id,
    date || existing.date,
    start_time || existing.start_time,
    end_time || existing.end_time,
    location !== undefined ? location : existing.location,
    service_type || existing.service_type,
    hours !== undefined ? hours : existing.hours,
    hourly_rate !== undefined ? hourly_rate : existing.hourly_rate,
    notes !== undefined ? notes : existing.notes,
    status || existing.status,
    req.params.id
  );

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(shift);
}

function deleteShift(req, res) {
  const db = getDb();
  const result = db.prepare('DELETE FROM shifts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Shift not found.' });
  res.json({ message: 'Shift deleted successfully.' });
}

function assignShift(req, res) {
  const { staff_id } = req.body;
  if (!staff_id) return res.status(400).json({ error: 'Staff ID is required.' });

  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'Shift is not available for assignment.' });

  db.prepare('UPDATE shifts SET staff_id=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(staff_id, 'assigned', req.params.id);

  createNotification(staff_id, 'Shift Assigned', `You have been assigned to a ${shift.service_type} shift on ${shift.date}.`, 'info', `/shifts`);

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function approveShift(req, res) {
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.status !== 'assigned') return res.status(400).json({ error: 'Shift must be assigned before approval.' });

  db.prepare('UPDATE shifts SET status=?, approved_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run('assigned', req.user.id, req.params.id);

  if (shift.staff_id) {
    createNotification(shift.staff_id, 'Shift Approved', `Your ${shift.service_type} shift on ${shift.date} has been approved.`, 'success', `/shifts`);
  }

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function pickShift(req, res) {
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'Shift is not available.' });

  db.prepare('UPDATE shifts SET staff_id=?, status="assigned", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.user.id, req.params.id);

  createNotification(req.user.id, 'Shift Picked', `You have picked up the ${shift.service_type} shift on ${shift.date}.`, 'success', `/shifts`);

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function rejectShift(req, res) {
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });

  db.prepare('UPDATE shifts SET staff_id=NULL, status="open", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);

  res.json({ message: 'Shift rejected. It has been returned to open shifts.' });
}

function startShift(req, res) {
  const { latitude, longitude } = req.body;
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });
  if (shift.status !== 'assigned') return res.status(400).json({ error: 'Shift must be in assigned status to start.' });

  db.prepare('UPDATE shifts SET status="in_progress", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);

  if (latitude && longitude) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, timestamp, action) VALUES (?,?,?,?,?,?)').run(req.params.id, req.user.id, latitude, longitude, now, 'start');
  }

  const attendanceDate = shift.date;
  const existingAtt = db.prepare('SELECT id FROM attendance WHERE shift_id = ?').get(req.params.id);
  if (!existingAtt) {
    db.prepare('INSERT INTO attendance (shift_id, staff_id, clock_in, date) VALUES (?,?,?,?)').run(req.params.id, req.user.id, new Date().toISOString(), attendanceDate);
  } else {
    db.prepare('UPDATE attendance SET clock_in = ? WHERE id = ?').run(new Date().toISOString(), existingAtt.id);
  }

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
}

function endShift(req, res) {
  const { latitude, longitude } = req.body;
  const db = getDb();
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });
  if (shift.status !== 'in_progress') return res.status(400).json({ error: 'Shift is not in progress.' });

  const now = new Date();
  const endTime = now.toISOString();

  db.prepare('UPDATE shifts SET status="completed", updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);

  if (latitude && longitude) {
    db.prepare('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, timestamp, action) VALUES (?,?,?,?,?,?)').run(req.params.id, req.user.id, latitude, longitude, endTime, 'end');
  }

  // Update attendance
  const attendance = db.prepare('SELECT * FROM attendance WHERE shift_id = ?').get(req.params.id);
  if (attendance) {
    const clockIn = new Date(attendance.clock_in);
    const hoursWorked = Math.round((now - clockIn) / (1000 * 60 * 60) * 100) / 100;
    const scheduledStart = new Date(`${shift.date}T${shift.start_time}`);
    const lateMinutes = clockIn > scheduledStart ? Math.round((clockIn - scheduledStart) / 60000) : 0;
    const overtime = hoursWorked > shift.hours ? Math.round((hoursWorked - shift.hours) * 100) / 100 : 0;

    db.prepare('UPDATE attendance SET clock_out=?, hours_worked=?, late_minutes=?, overtime=?, status=? WHERE id=?').run(endTime, hoursWorked, lateMinutes, overtime, lateMinutes > 15 ? 'late' : 'present', attendance.id);

    // Update staff completed shifts count
    const completedCount = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE staff_id = ? AND status = 'completed'").get(req.user.id);
    db.prepare('UPDATE staff_profiles SET completed_shifts = ? WHERE user_id = ?').run(completedCount.count, req.user.id);
  }

  // Auto-generate invoice
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(shift.client_id);
  if (client) {
    const settings = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
    const prefix = settings ? settings.value : 'INV-';
    const count = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
    const invoiceNumber = `${prefix}${String(count.count + 1).padStart(4, '0')}`;
    const taxSetting = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
    const taxRate = parseFloat(taxSetting ? taxSetting.value : 0);
    const attendance2 = db.prepare('SELECT * FROM attendance WHERE shift_id = ?').get(req.params.id);
    const hoursActual = attendance2 ? attendance2.hours_worked : shift.hours;
    const subtotal = Math.round(hoursActual * shift.hourly_rate * 100) / 100;
    const tax = Math.round(subtotal * taxRate / 100 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    db.prepare('INSERT INTO invoices (invoice_number, client_id, shift_id, staff_id, hours_worked, hourly_rate, subtotal, tax, tax_rate, total, status, due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(invoiceNumber, shift.client_id, req.params.id, req.user.id, hoursActual, shift.hourly_rate, subtotal, tax, taxRate, total, 'pending', dueDate.toISOString().split('T')[0]);

    createNotification(shift.client_id, 'Invoice Generated', `Invoice ${invoiceNumber} has been generated for your recent shift.`, 'info', `/invoices`);
  }

  createNotification(req.user.id, 'Shift Completed', `You have completed the ${shift.service_type} shift.`, 'success', `/shifts`);

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  res.json(updated);
}

module.exports = { listShifts, getShift, createShift, updateShift, deleteShift, assignShift, approveShift, pickShift, rejectShift, startShift, endShift };
