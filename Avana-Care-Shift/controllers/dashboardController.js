const { getDb } = require('../models/db');

function getAdminDashboard(req, res) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString().split(':')[0] + ':00';

  const todayShifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date = ?").get(today);
  const openShifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'open'").get();
  const upcomingShifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND status IN ('assigned','open')").get(today);
  const completedShifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'completed'").get();
  const cancelledShifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'cancelled'").get();
  const totalStaff = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'staff' AND status = 'active'").get();
  const totalClients = db.prepare("SELECT COUNT(*) as count FROM clients").get();
  const pendingRequests = db.prepare("SELECT COUNT(*) as count FROM shift_requests WHERE status = 'pending'").get();
  const workingNow = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'in_progress'").get();

  const monthlyIncome = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total FROM invoices 
    WHERE status = 'paid' 
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get();

  const recentShifts = db.prepare(`
    SELECT s.*, c.name as client_name, u.username as staff_name 
    FROM shifts s 
    LEFT JOIN clients c ON s.client_id = c.id 
    LEFT JOIN users u ON s.staff_id = u.id 
    ORDER BY s.created_at DESC LIMIT 5
  `).all();

  const recentRequests = db.prepare(`
    SELECT * FROM shift_requests ORDER BY created_at DESC LIMIT 5
  `).all();

  const pendingInvoices = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
    FROM invoices WHERE status IN ('pending','overdue')
  `).get();

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
}

function getStaffDashboard(req, res) {
  const db = getDb();
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const todayShift = db.prepare(`
    SELECT s.*, c.name as client_name, c.address as client_address 
    FROM shifts s 
    JOIN clients c ON s.client_id = c.id 
    WHERE s.staff_id = ? AND s.date = ? 
    ORDER BY s.start_time LIMIT 1
  `).get(userId, today);

  const upcomingShifts = db.prepare(`
    SELECT s.*, c.name as client_name 
    FROM shifts s 
    JOIN clients c ON s.client_id = c.id 
    WHERE s.staff_id = ? AND s.date >= ? AND s.status IN ('assigned','in_progress')
    ORDER BY s.date, s.start_time LIMIT 10
  `).all(userId, today);

  const completedShifts = db.prepare(`
    SELECT COUNT(*) as count FROM shifts 
    WHERE staff_id = ? AND status = 'completed'
  `).get(userId);

  const totalEarnings = db.prepare(`
    SELECT COALESCE(SUM(s.hours * s.hourly_rate), 0) as total 
    FROM shifts s WHERE s.staff_id = ? AND s.status = 'completed'
  `).get(userId);

  const openShifts = db.prepare(`
    SELECT s.*, c.name as client_name, c.address as client_address 
    FROM shifts s 
    JOIN clients c ON s.client_id = c.id 
    WHERE s.status = 'open' AND s.date >= ?
    ORDER BY s.date, s.start_time LIMIT 10
  `).all(today);

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(hours), 0) as total_hours 
    FROM shifts WHERE staff_id = ? AND status = 'completed' 
    AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `).get(userId);

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(userId);

  res.json({
    todayShift,
    upcomingShifts: upcomingShifts,
    completedShifts: completedShifts.count,
    totalEarnings: totalEarnings.total,
    openShifts,
    thisMonth: thisMonth.count,
    thisMonthHours: thisMonth.total_hours,
    notifications
  });
}

function getClientDashboard(req, res) {
  const db = getDb();
  const userId = req.user.id;
  const client = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(userId);
  if (!client) return res.status(404).json({ error: 'Client profile not found.' });

  const clientId = client.id;
  const today = new Date().toISOString().split('T')[0];

  const upcomingShifts = db.prepare(`
    SELECT s.*, u.username as staff_name 
    FROM shifts s 
    LEFT JOIN users u ON s.staff_id = u.id 
    WHERE s.client_id = ? AND s.date >= ? AND s.status IN ('assigned','open')
    ORDER BY s.date, s.start_time
  `).all(clientId, today);

  const completedShifts = db.prepare(`
    SELECT COUNT(*) as count FROM shifts WHERE client_id = ? AND status = 'completed'
  `).get(clientId);

  const totalInvoices = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
    FROM invoices WHERE client_id = ?
  `).get(clientId);

  const pendingInvoices = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
    FROM invoices WHERE client_id = ? AND status = 'pending'
  `).get(clientId);

  const recentRequests = db.prepare(`
    SELECT * FROM shift_requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(clientId);

  const recentShifts = db.prepare(`
    SELECT s.*, u.username as staff_name 
    FROM shifts s 
    LEFT JOIN users u ON s.staff_id = u.id 
    WHERE s.client_id = ? ORDER BY s.date DESC LIMIT 5
  `).all(clientId);

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(userId);

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
}

module.exports = { getAdminDashboard, getStaffDashboard, getClientDashboard };
