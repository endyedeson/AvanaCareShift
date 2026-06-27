const { query, queryOne } = require('../models/db');

async function getDailyReport(req, res) {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    const shifts = await queryOne('SELECT COUNT(*) as count FROM shifts WHERE date = ?', [reportDate]);
    const completed = await queryOne("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date = ? AND status = 'completed'", [reportDate]);
    const cancelled = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date = ? AND status = 'cancelled'", [reportDate]);
    const inProgress = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE status = 'in_progress'");
    const staffWorking = await queryOne("SELECT COUNT(DISTINCT staff_id) as count FROM shifts WHERE date = ? AND status IN ('assigned','in_progress')", [reportDate]);

    const revenue = await queryOne("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE DATE(created_at) = ? AND status = 'paid'", [reportDate]);

    const shiftDetails = await query(`
      SELECT s.*, c.name as client_name, u.username as staff_name 
      FROM shifts s LEFT JOIN clients c ON s.client_id = c.id 
      LEFT JOIN users u ON s.staff_id = u.id 
      WHERE s.date = ? ORDER BY s.start_time
    `, [reportDate]);

    res.json({ date: reportDate, totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, inProgress: inProgress.count, staffWorking: staffWorking.count, revenue: revenue.total, shiftDetails });
  } catch (err) {
    console.error('getDailyReport error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getWeeklyReport(req, res) {
  try {
    const { date } = req.query;
    const refDate = date ? new Date(date) : new Date();
    const dayOfWeek = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const shifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND date <= ?", [mondayStr, sundayStr]);
    const completed = await queryOne("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date >= ? AND date <= ? AND status = 'completed'", [mondayStr, sundayStr]);
    const cancelled = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date >= ? AND date <= ? AND status = 'cancelled'", [mondayStr, sundayStr]);

    const revenue = await queryOne("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND status = 'paid'", [mondayStr, sundayStr]);

    const daily = await query(`
      SELECT date, COUNT(*) as shifts, 
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
             COALESCE(SUM(CASE WHEN status='completed' THEN hours ELSE 0 END),0) as hours
      FROM shifts WHERE date >= ? AND date <= ?
      GROUP BY date ORDER BY date
    `, [mondayStr, sundayStr]);

    res.json({ weekStart: mondayStr, weekEnd: sundayStr, totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, revenue: revenue.total, dailyBreakdown: daily });
  } catch (err) {
    console.error('getWeeklyReport error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getMonthlyReport(req, res) {
  try {
    const { month, year } = req.query;
    const m = month || (new Date().getMonth() + 1);
    const y = year || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;

    const shifts = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date LIKE ?", [`${monthStr}%`]);
    const completed = await queryOne("SELECT COUNT(*) as count, COALESCE(SUM(hours),0) as total_hours FROM shifts WHERE date LIKE ? AND status = 'completed'", [`${monthStr}%`]);
    const cancelled = await queryOne("SELECT COUNT(*) as count FROM shifts WHERE date LIKE ? AND status = 'cancelled'", [`${monthStr}%`]);

    const revenue = await queryOne("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE DATE_FORMAT(created_at, '%Y-%m') = ? AND status = 'paid'", [monthStr]);
    const pendingRevenue = await queryOne("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE DATE_FORMAT(created_at, '%Y-%m') = ? AND status = 'pending'", [monthStr]);

    const staffHours = await query(`
      SELECT u.id, u.username, COUNT(s.id) as shifts, COALESCE(SUM(s.hours),0) as total_hours
      FROM users u LEFT JOIN shifts s ON u.id = s.staff_id AND s.date LIKE ? AND s.status = 'completed'
      WHERE u.role = 'staff' AND u.status = 'active'
      GROUP BY u.id ORDER BY total_hours DESC
    `, [`${monthStr}%`]);

    const clientStats = await query(`
      SELECT c.id, c.name, COUNT(s.id) as shifts, COALESCE(SUM(s.hours),0) as total_hours
      FROM clients c LEFT JOIN shifts s ON c.id = s.client_id AND s.date LIKE ?
      GROUP BY c.id ORDER BY shifts DESC
    `, [`${monthStr}%`]);

    res.json({ month: parseInt(m), year: parseInt(y), totalShifts: shifts.count, completedShifts: completed.count, totalHours: completed.total_hours, cancelledShifts: cancelled.count, revenue: revenue.total, pendingRevenue: pendingRevenue.total, staffHours, clientStats });
  } catch (err) {
    console.error('getMonthlyReport error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getRevenueReport(req, res) {
  try {
    const { from, to } = req.query;

    let where = ["status = 'paid'"];
    let params = [];
    if (from) { where.push('DATE(created_at) >= ?'); params.push(from); }
    if (to) { where.push('DATE(created_at) <= ?'); params.push(to); }

    const whereClause = where.join(' AND ');
    const data = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as invoices, SUM(total) as revenue
      FROM invoices WHERE ${whereClause}
      GROUP BY DATE(created_at) ORDER BY date
    `, params);

    const totals = await queryOne(`SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM invoices WHERE ${whereClause}`, params);

    res.json({ data, totals: { count: totals.count, total: totals.total } });
  } catch (err) {
    console.error('getRevenueReport error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function exportCSV(req, res) {
  try {
    const { type, from, to } = req.query;
    let data = [];
    let headers = [];

    if (type === 'shifts' || !type) {
      headers = ['ID', 'Date', 'Start', 'End', 'Client', 'Staff', 'Service Type', 'Hours', 'Rate', 'Status', 'Location'];
      let where = ['1=1'];
      let params = [];
      if (from) { where.push('s.date >= ?'); params.push(from); }
      if (to) { where.push('s.date <= ?'); params.push(to); }
      data = await query(`SELECT s.id, s.date, s.start_time, s.end_time, c.name as client, COALESCE(u.username,'') as staff, s.service_type, s.hours, s.hourly_rate, s.status, s.location FROM shifts s LEFT JOIN clients c ON s.client_id = c.id LEFT JOIN users u ON s.staff_id = u.id WHERE ${where.join(' AND ')} ORDER BY s.date`, params);
    } else if (type === 'invoices') {
      headers = ['Invoice #', 'Client', 'Staff', 'Hours', 'Rate', 'Subtotal', 'Tax', 'Total', 'Status', 'Due Date', 'Created'];
      let where = ['1=1'];
      let params = [];
      if (from) { where.push('DATE(i.created_at) >= ?'); params.push(from); }
      if (to) { where.push('DATE(i.created_at) <= ?'); params.push(to); }
      data = await query(`SELECT i.invoice_number, c.name as client, COALESCE(u.username,'') as staff, i.hours_worked, i.hourly_rate, i.subtotal, i.tax, i.total, i.status, i.due_date, i.created_at FROM invoices i LEFT JOIN clients c ON i.client_id = c.id LEFT JOIN users u ON i.staff_id = u.id WHERE ${where.join(' AND ')} ORDER BY i.created_at`, params);
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
  } catch (err) {
    console.error('exportCSV error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getDailyReport, getWeeklyReport, getMonthlyReport, getRevenueReport, exportCSV };
