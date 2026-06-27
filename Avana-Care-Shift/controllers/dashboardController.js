const { query, queryOne } = require('../models/db');

async function getAdminDashboard(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayShifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date = ?", [today]);
    const openShifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE status = 'open'");
    const upcomingShifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND status IN ('assigned','open')", [today]);
    const completedShifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE status = 'completed'");
    const cancelledShifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE status = 'cancelled'");
    const totalStaff = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'staff' AND status = 'active'");
    const totalClients = await queryOne("SELECT COUNT(*) as count FROM clients");
    const pendingRequests = await queryOne("SELECT COUNT(*) as count FROM shift_requests WHERE status = 'pending'");
    const workingNow = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE status = 'in_progress'");

    const monthlyIncome = await queryOne(`
      SELECT COALESCE(SUM(total), 0) as total FROM invoices 
      WHERE status = 'paid' 
      AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
    `);

    const recentShifts = await query(`
      SELECT s.*, c.name as client_name, u.username as staff_name 
      FROM shifts s 
      LEFT JOIN clients c ON s.client_id = c.id 
      LEFT JOIN users u ON s.staff_id = u.id 
      ORDER BY s.created_at DESC LIMIT 5
    `);

    const recentRequests = await query(`
      SELECT * FROM shift_requests ORDER BY created_at DESC LIMIT 5
    `);

    const pendingInvoices = await queryOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
      FROM invoices WHERE status IN ('pending','overdue')
    `);

    res.json({
      todayShifts: todayShifts.count,
      openShifts: openShifts.count,
      upcomingShifts: upcomingShifts.count,
      completedShifts: completedShifts.count,
      cancelledShifts: cancelledShifts.count,
      totalStaff: totalStaff.count,
      totalClients: totalClients.count,
      pendingRequests: pendingRequests.count,
      workingNow: workingNow.count,
      monthlyIncome: monthlyIncome.total,
      pendingInvoices: pendingInvoices.count,
      pendingInvoiceTotal: pendingInvoices.total,
      recentShifts,
      recentRequests
    });
  } catch (err) {
    console.error('getAdminDashboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getStaffDashboard(req, res) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const todayShift = await queryOne(`
      SELECT s.*, c.name as client_name, c.address as client_address 
      FROM shifts s 
      JOIN clients c ON s.client_id = c.id 
      WHERE s.staff_id = ? AND s.date = ? 
      ORDER BY s.start_time LIMIT 1
    `, [userId, today]);

    const upcomingShifts = await query(`
      SELECT s.*, c.name as client_name 
      FROM shifts s 
      JOIN clients c ON s.client_id = c.id 
      WHERE s.staff_id = ? AND s.date >= ? AND s.status IN ('assigned','in_progress')
      ORDER BY s.date, s.start_time LIMIT 10
    `, [userId, today]);

    const completedShifts = await queryOne(`
      SELECT COUNT(*) as count FROM shifts 
      WHERE staff_id = ? AND status = 'completed'
    `, [userId]);

    const totalEarnings = await queryOne(`
      SELECT COALESCE(SUM(s.hours * s.hourly_rate), 0) as total 
      FROM shifts s WHERE s.staff_id = ? AND s.status = 'completed'
    `, [userId]);

    const openShifts = await query(`
      SELECT s.*, c.name as client_name, c.address as client_address 
      FROM shifts s 
      JOIN clients c ON s.client_id = c.id 
      WHERE s.status = 'open' AND s.date >= ?
      ORDER BY s.date, s.start_time LIMIT 10
    `, [today]);

    const thisMonth = await queryOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(hours), 0) as total_hours 
      FROM shifts WHERE staff_id = ? AND status = 'completed' 
      AND DATE_FORMAT(date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
    `, [userId]);

    const notifications = await query(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    `, [userId]);

    res.json({
      todayShift,
      upcomingShifts,
      completedShifts: completedShifts.count,
      totalEarnings: totalEarnings.total,
      openShifts,
      thisMonth: thisMonth.count,
      thisMonthHours: thisMonth.total_hours,
      notifications
    });
  } catch (err) {
    console.error('getStaffDashboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getClientDashboard(req, res) {
  try {
    const userId = req.user.id;
    const client = await queryOne('SELECT id FROM clients WHERE user_id = ?', [userId]);
    if (!client) return res.status(404).json({ error: 'Client profile not found.' });

    const clientId = client.id;
    const today = new Date().toISOString().split('T')[0];

    const upcomingShifts = await query(`
      SELECT s.*, u.username as staff_name 
      FROM shifts s 
      LEFT JOIN users u ON s.staff_id = u.id 
      WHERE s.client_id = ? AND s.date >= ? AND s.status IN ('assigned','open')
      ORDER BY s.date, s.start_time
    `, [clientId, today]);

    const completedShifts = await queryOne(`
      SELECT COUNT(*) as count FROM shifts WHERE client_id = ? AND status = 'completed'
    `, [clientId]);

    const totalInvoices = await queryOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
      FROM invoices WHERE client_id = ?
    `, [clientId]);

    const pendingInvoices = await queryOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
      FROM invoices WHERE client_id = ? AND status = 'pending'
    `, [clientId]);

    const recentRequests = await query(`
      SELECT * FROM shift_requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 5
    `, [clientId]);

    const recentShifts = await query(`
      SELECT s.*, u.username as staff_name 
      FROM shifts s 
      LEFT JOIN users u ON s.staff_id = u.id 
      WHERE s.client_id = ? ORDER BY s.date DESC LIMIT 5
    `, [clientId]);

    const notifications = await query(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    `, [userId]);

    res.json({
      upcomingShifts,
      completedShifts: completedShifts.count,
      totalInvoices: totalInvoices.count,
      totalBilled: totalInvoices.total,
      pendingInvoices: pendingInvoices.count,
      pendingAmount: pendingInvoices.total,
      recentRequests,
      recentShifts,
      notifications
    });
  } catch (err) {
    console.error('getClientDashboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getAdminDashboard, getStaffDashboard, getClientDashboard };
