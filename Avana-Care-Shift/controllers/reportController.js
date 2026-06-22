const { getDb } = require('../models/db');

function getDailyReport(req, res) {
  const { date } = req.query;
  const reportDate = date || new Date().toISOString().split('T')[0];
  const db = getDb();

  const shifts = db.prepare('SELECT COUNT(*) as count FROM shifts WHERE date = ?').get(reportDate);
  const completed = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date = ? AND status = 'completed'").get(reportDate);
  const cancelled = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date = ? AND status = 'cancelled'").get(reportDate);
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'in_progress'").get();
  const staffWorking = db.prepare("SELECT COUNT(DISTINCT staff_id) as count FROM shifts WHERE date = ? AND status IN ('assigned','in_progress')").get(reportDate);

  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE date(created_at) = ? AND status = 'paid'").get(reportDate);

  const shiftDetails = db.prepare(`
    SELECT s.*, c.name as client_name, u.username as staff_name 
    FROM shifts s LEFT JOIN clients c ON s.client_id = c.id 
    LEFT JOIN users u ON s.staff_id = u.id 
    WHERE s.date = ? ORDER BY s.start_time
  `).all(reportDate);

  res.json({ date: reportDate, totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, inProgress: inProgress.count, staffWorking: staffWorking.count, revenue: revenue.total, shiftDetails });
}

function getWeeklyReport(req, res) {
  const { date } = req.query;
  const refDate = date ? new Date(date) : new Date();
  const dayOfWeek = refDate.getDay();
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  const db = getDb();
  const shifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND date <= ?").get(mondayStr, sundayStr);
  const completed = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date >= ? AND date <= ? AND status = 'completed'").get(mondayStr, sundayStr);
  const cancelled = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND date <= ? AND status = 'cancelled'").get(mondayStr, sundayStr);

  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'paid'").get(mondayStr, sundayStr);

  const daily = db.prepare(`
    SELECT date, COUNT(*) as shifts, 
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
           COALESCE(SUM(CASE WHEN status='completed' THEN hours ELSE 0 END),0) as hours
    FROM shifts WHERE date >= ? AND date <= ?
    GROUP BY date ORDER BY date
  `).all(mondayStr, sundayStr);

  res.json({ weekStart: mondayStr, weekEnd: sundayStr, totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, revenue: revenue.total, dailyBreakdown: daily });
}

function getMonthlyReport(req, res) {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();
  const monthStr = `${y}-${String(m).padStart(2, '0')}`;

  const db = getDb();
  const shifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date LIKE ?").get(`${monthStr}%`);
  const completed = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date LIKE ? AND status = 'completed'").get(`${monthStr}%`);
  const cancelled = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE date LIKE ? AND status = 'cancelled'").get(`${monthStr}%`);

  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y-%m', created_at) = ? AND status = 'paid'").get(monthStr);
  const pendingRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE strftime('%Y-%m', created_at) = ? AND status = 'pending'").get(monthStr);

  const staffHours = db.prepare(`
    SELECT u.id, u.username, COUNT(s.id) as shifts, COALESCE(SUM(s.hours),0) as total_hours
    FROM users u LEFT JOIN shifts s ON u.id = s.staff_id AND s.date LIKE ? AND s.status = 'completed'
    WHERE u.role = 'staff' AND u.status = 'active'
    GROUP BY u.id ORDER BY total_hours DESC
  `).all(`${monthStr}%`);

  const clientStats = db.prepare(`
    SELECT c.id, c.name, COUNT(s.id) as shifts, COALESCE(SUM(s.hours),0) as total_hours
    FROM clients c LEFT JOIN shifts s ON c.id = s.client_id AND s.date LIKE ?
    GROUP BY c.id ORDER BY shifts DESC
  `).all(`${monthStr}%`);

  res.json({ month: parseInt(m), year: parseInt(y), totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, revenue: revenue.total, pendingRevenue: pendingRevenue.total, staffHours, clientStats });
}

function getRevenueReport(req, res) {
  const { from, to } = req.query;
  const db = getDb();

  let where = ["status = 'paid'"];
  let params = [];
  if (from) { where.push('date(created_at) >= ?'); params.push(from); }
  if (to) { where.push('date(created_at) <= ?'); params.push(to); }

  const whereClause = where.join(' AND ');
  const data = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as invoices, SUM(total) as revenue
    FROM invoices WHERE ${whereClause}
    GROUP BY date(created_at) ORDER BY date
  `).all(...params);

  const totals = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM invoices WHERE ${whereClause}`).get(...params);

  res.json({ data, totals: { count: totals.count, total: totals.total } });
}

function exportCSV(req, res) {
  const { type, from, to } = req.query;
  const db = getDb();
  let data = [];
  let headers = [];

  if (type === 'shifts' || !type) {
    headers = ['ID', 'Date', 'Start', 'End', 'Client', 'Staff', 'Service Type', 'Hours', 'Rate', 'Status', 'Location'];
    let where = ['1=1'];
    let params = [];
    if (from) { where.push('s.date >= ?'); params.push(from); }
    if (to) { where.push('s.date <= ?'); params.push(to); }
    data = db.prepare(`SELECT s.id, s.date, s.start_time, s.end_time, c.name as client, COALESCE(u.username,'') as staff, s.service_type, s.hours, s.hourly_rate, s.status, s.location FROM shifts s LEFT JOIN clients c ON s.client_id = c.id LEFT JOIN users u ON s.staff_id = u.id WHERE ${where.join(' AND ')} ORDER BY s.date`).all(...params);
  } else if (type === 'invoices') {
    headers = ['Invoice #', 'Client', 'Staff', 'Hours', 'Rate', 'Subtotal', 'Tax', 'Total', 'Status', 'Due Date', 'Created'];
    let where = ['1=1'];
    let params = [];
    if (from) { where.push('date(i.created_at) >= ?'); params.push(from); }
    if (to) { where.push('date(i.created_at) <= ?'); params.push(to); }
    data = db.prepare(`SELECT i.invoice_number, c.name as client, COALESCE(u.username,'') as staff, i.hours_worked, i.hourly_rate, i.subtotal, i.tax, i.total, i.status, i.due_date, i.created_at FROM invoices i LEFT JOIN clients c ON i.client_id = c.id LEFT JOIN users u ON i.staff_id = u.id WHERE ${where.join(' AND ')} ORDER BY i.created_at`).all(...params);
  }

  let csv = headers.join(',') + '\n';
  for (const row of data) {
    const values = headers.map(h => {
      const key = h.toLowerCase().replace(/[#\s]+/g, '_').replace(/^_/, '').replace(/_$/, '');
      const val = row[key] !== undefined ? String(row[key]).replace(/"/g, '""') : '';
      return `"${val}"`;
    });
    csv += values.join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type || 'shifts'}-report.csv"`);
  res.send(csv);
}

module.exports = { getDailyReport, getWeeklyReport, getMonthlyReport, getRevenueReport, exportCSV };
