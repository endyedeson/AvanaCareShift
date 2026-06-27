const { query, queryOne, run } = require('../models/db');
const { createNotification } = require('../models/notifications');

async function listShifts(req, res) {
  try {
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

    const total = await queryOne(`SELECT COUNT(*) as count FROM shifts s LEFT JOIN clients c ON s.client_id = c.id LEFT JOIN users u ON s.staff_id = u.id WHERE ${whereClause}`, params);

    const shifts = await query(`
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
    `, [...params, parseInt(limit), offset]);

    res.json({
      shifts,
      pagination: {
        total: total.count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.count / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('listShifts error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getShift(req, res) {
  try {
    const shift = await queryOne(`
      SELECT s.*, c.name as client_name, c.address as client_address, c.phone as client_phone,
             u.username as staff_name, u.avatar as staff_avatar,
             sp.phone as staff_phone, sp.skills as staff_skills
      FROM shifts s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.staff_id = u.id
      LEFT JOIN staff_profiles sp ON s.staff_id = sp.user_id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!shift) return res.status(404).json({ error: 'Shift not found.' });

    const gpsLogs = await query('SELECT * FROM gps_logs WHERE shift_id = ? ORDER BY timestamp', [req.params.id]);
    const attendance = await queryOne('SELECT * FROM attendance WHERE shift_id = ?', [req.params.id]);

    res.json({ shift, gpsLogs, attendance });
  } catch (err) {
    console.error('getShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createShift(req, res) {
  try {
    const { client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status } = req.body;
    if (!client_id || !date || !start_time || !end_time || !service_type) {
      return res.status(400).json({ error: 'Client, date, start time, end time, and service type are required.' });
    }

    const result = await run(`
      INSERT INTO shifts (client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [client_id, date, start_time, end_time, location || '', service_type, hours || 0, hourly_rate || 0, notes || '', status || 'open', req.user.id]);

    const shiftId = result.insertId;

    if (status === 'open' || !status) {
      const staffUsers = await query("SELECT id FROM users WHERE role = 'staff' AND status = 'active'");
      for (const staff of staffUsers) {
        await createNotification(staff.id, 'New Shift Available', `A new ${service_type} shift has been posted for ${date}.`, 'info', '/shifts');
      }
    }

    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [shiftId]);
    res.status(201).json(shift);
  } catch (err) {
    console.error('createShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateShift(req, res) {
  try {
    const { client_id, date, start_time, end_time, location, service_type, hours, hourly_rate, notes, status } = req.body;

    const existing = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Shift not found.' });

    await run(`
      UPDATE shifts SET client_id=?, date=?, start_time=?, end_time=?, location=?, 
      service_type=?, hours=?, hourly_rate=?, notes=?, status=?
      WHERE id=?
    `, [
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
    ]);

    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(shift);
  } catch (err) {
    console.error('updateShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteShift(req, res) {
  try {
    const result = await run('DELETE FROM shifts WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Shift not found.' });
    res.json({ message: 'Shift deleted successfully.' });
  } catch (err) {
    console.error('deleteShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function assignShift(req, res) {
  try {
    const { staff_id } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'Staff ID is required.' });

    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.status !== 'open') return res.status(400).json({ error: 'Shift is not available for assignment.' });

    await run('UPDATE shifts SET staff_id=?, status=? WHERE id=?', [staff_id, 'assigned', req.params.id]);

    await createNotification(staff_id, 'Shift Assigned', `You have been assigned to a ${shift.service_type} shift on ${shift.date}.`, 'info', '/shifts');

    const updated = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('assignShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function approveShift(req, res) {
  try {
    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.status !== 'assigned') return res.status(400).json({ error: 'Shift must be assigned before approval.' });

    await run('UPDATE shifts SET status=?, approved_by=? WHERE id=?', ['assigned', req.user.id, req.params.id]);

    if (shift.staff_id) {
      await createNotification(shift.staff_id, 'Shift Approved', `Your ${shift.service_type} shift on ${shift.date} has been approved.`, 'success', '/shifts');
    }

    const updated = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('approveShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function pickShift(req, res) {
  try {
    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.status !== 'open') return res.status(400).json({ error: 'Shift is not available.' });

    await run('UPDATE shifts SET staff_id=?, status="assigned" WHERE id=?', [req.user.id, req.params.id]);

    await createNotification(req.user.id, 'Shift Picked', `You have picked up the ${shift.service_type} shift on ${shift.date}.`, 'success', '/shifts');

    const updated = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('pickShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function rejectShift(req, res) {
  try {
    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });

    await run('UPDATE shifts SET staff_id=NULL, status="open" WHERE id=?', [req.params.id]);

    res.json({ message: 'Shift rejected. It has been returned to open shifts.' });
  } catch (err) {
    console.error('rejectShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function startShift(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });
    if (shift.status !== 'assigned') return res.status(400).json({ error: 'Shift must be in assigned status to start.' });

    await run('UPDATE shifts SET status="in_progress" WHERE id=?', [req.params.id]);

    if (latitude && longitude) {
      const now = new Date().toISOString();
      await run('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, timestamp, action) VALUES (?,?,?,?,?,?)',
        [req.params.id, req.user.id, latitude, longitude, now, 'start']);
    }

    const attendanceDate = shift.date;
    const existingAtt = await queryOne('SELECT id FROM attendance WHERE shift_id = ?', [req.params.id]);
    if (!existingAtt) {
      await run('INSERT INTO attendance (shift_id, staff_id, clock_in, date) VALUES (?,?,?,?)',
        [req.params.id, req.user.id, new Date().toISOString(), attendanceDate]);
    } else {
      await run('UPDATE attendance SET clock_in = ? WHERE id = ?', [new Date().toISOString(), existingAtt.id]);
    }

    const updated = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('startShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function endShift(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const shift = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found.' });
    if (shift.staff_id !== req.user.id) return res.status(403).json({ error: 'This shift is not assigned to you.' });
    if (shift.status !== 'in_progress') return res.status(400).json({ error: 'Shift is not in progress.' });

    const now = new Date();
    const endTime = now.toISOString();

    await run('UPDATE shifts SET status="completed" WHERE id=?', [req.params.id]);

    if (latitude && longitude) {
      await run('INSERT INTO gps_logs (shift_id, staff_id, latitude, longitude, timestamp, action) VALUES (?,?,?,?,?,?)',
        [req.params.id, req.user.id, latitude, longitude, endTime, 'end']);
    }

    const attendance = await queryOne('SELECT * FROM attendance WHERE shift_id = ?', [req.params.id]);
    if (attendance) {
      const clockIn = new Date(attendance.clock_in);
      const hoursWorked = Math.round((now - clockIn) / (1000 * 60 * 60) * 100) / 100;
      const scheduledStart = new Date(`${shift.date}T${shift.start_time}`);
      const lateMinutes = clockIn > scheduledStart ? Math.round((clockIn - scheduledStart) / 60000) : 0;
      const overtime = hoursWorked > shift.hours ? Math.round((hoursWorked - shift.hours) * 100) / 100 : 0;

      await run('UPDATE attendance SET clock_out=?, hours_worked=?, late_minutes=?, overtime=?, status=? WHERE id=?',
        [endTime, hoursWorked, lateMinutes, overtime, lateMinutes > 15 ? 'late' : 'present', attendance.id]);

      const completedCount = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE staff_id = ? AND status = 'completed'", [req.user.id]);
      await run('UPDATE staff_profiles SET completed_shifts = ? WHERE user_id = ?', [completedCount.count, req.user.id]);
    }

    const client = await queryOne('SELECT * FROM clients WHERE id = ?', [shift.client_id]);
    if (client) {
      const settingsRow = await queryOne("SELECT value FROM settings WHERE `key` = 'invoice_prefix'");
      const prefix = settingsRow ? settingsRow.value : 'INV-';
      const count = await queryOne('SELECT COUNT(*) as count FROM invoices');
      const invoiceNumber = `${prefix}${String(count.count + 1).padStart(4, '0')}`;
      const taxSetting = await queryOne("SELECT value FROM settings WHERE `key` = 'tax_rate'");
      const taxRate = parseFloat(taxSetting ? taxSetting.value : 0);
      const attendance2 = await queryOne('SELECT * FROM attendance WHERE shift_id = ?', [req.params.id]);
      const hoursActual = attendance2 ? attendance2.hours_worked : shift.hours;
      const subtotal = Math.round(hoursActual * shift.hourly_rate * 100) / 100;
      const tax = Math.round(subtotal * taxRate / 100 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await run('INSERT INTO invoices (invoice_number, client_id, shift_id, staff_id, hours_worked, hourly_rate, subtotal, tax, tax_rate, total, status, due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [invoiceNumber, shift.client_id, req.params.id, req.user.id, hoursActual, shift.hourly_rate, subtotal, tax, taxRate, total, 'pending', dueDate.toISOString().split('T')[0]]);

      await createNotification(shift.client_id, 'Invoice Generated', `Invoice ${invoiceNumber} has been generated for your recent shift.`, 'info', '/invoices');
    }

    await createNotification(req.user.id, 'Shift Completed', `You have completed the ${shift.service_type} shift.`, 'success', '/shifts');

    const updated = await queryOne('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('endShift error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listShifts, getShift, createShift, updateShift, deleteShift, assignShift, approveShift, pickShift, rejectShift, startShift, endShift };
