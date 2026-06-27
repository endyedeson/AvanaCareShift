const { query, queryOne, run } = require('../models/db');
const PDFDocument = require('pdfkit');

async function listInvoices(req, res) {
  try {
    const { status, client_id, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'client') {
      const client = await queryOne('SELECT id FROM clients WHERE user_id = ?', [req.user.id]);
      if (client) { where.push('i.client_id = ?'); params.push(client.id); }
    }

    if (status) { where.push('i.status = ?'); params.push(status); }
    if (client_id) { where.push('i.client_id = ?'); params.push(client_id); }
    if (search) {
      where.push("(i.invoice_number LIKE ? OR c.name LIKE ?)");
      const q = `%${search}%`;
      params.push(q, q);
    }

    const whereClause = where.join(' AND ');
    const total = await queryOne(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE ${whereClause}`, params);

    const invoices = await query(`
      SELECT i.*, c.name as client_name, c.address as client_address,
             u.username as staff_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON i.staff_id = u.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({ invoices, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
  } catch (err) {
    console.error('listInvoices error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getInvoice(req, res) {
  try {
    const invoice = await queryOne(`
      SELECT i.*, c.name as client_name, c.address as client_address, c.phone as client_phone, 
             (SELECT email FROM users WHERE id = c.user_id) as client_email,
             u.username as staff_name, u.email as staff_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON i.staff_id = u.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    if (req.user.role === 'client') {
      const client = await queryOne('SELECT id FROM clients WHERE user_id = ?', [req.user.id]);
      if (!client || invoice.client_id !== client.id) return res.status(403).json({ error: 'Access denied.' });
    }

    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    res.json({ invoice, items });
  } catch (err) {
    console.error('getInvoice error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createInvoice(req, res) {
  try {
    const { client_id, shift_id, staff_id, hours_worked, hourly_rate, tax_rate, notes, items } = req.body;
    if (!client_id) return res.status(400).json({ error: 'Client ID is required.' });

    const prefixRow = await queryOne("SELECT value FROM settings WHERE `key` = 'invoice_prefix'");
    const prefix = prefixRow ? prefixRow.value : 'INV-';
    const count = await queryOne('SELECT COUNT(*) as count FROM invoices');
    const invoiceNumber = `${prefix}${String(count.count + 1).padStart(4, '0')}`;
    let taxRate = tax_rate;
    if (taxRate === undefined) {
      const taxRow = await queryOne("SELECT value FROM settings WHERE `key` = 'tax_rate'");
      taxRate = taxRow ? parseFloat(taxRow.value) : 0;
    }
    const hw = hours_worked || 0;
    const hr = hourly_rate || 0;
    const subtotal = Math.round(hw * hr * 100) / 100;
    const tax = Math.round(subtotal * taxRate / 100 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const result = await run(`
      INSERT INTO invoices (invoice_number, client_id, shift_id, staff_id, hours_worked, hourly_rate, subtotal, tax, tax_rate, total, status, due_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [invoiceNumber, client_id, shift_id || null, staff_id || null, hw, hr, subtotal, tax, taxRate, total, 'pending', dueDate.toISOString().split('T')[0], notes || '']);

    const invoiceId = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        const amount = Math.round((item.quantity || 1) * (item.rate || 0) * 100) / 100;
        await run('INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES (?,?,?,?,?)',
          [invoiceId, item.description, item.quantity || 1, item.rate || 0, amount]);
      }
    } else {
      await run('INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES (?,?,?,?,?)',
        [invoiceId, `Care Services - ${hw} hours`, hw, hr, subtotal]);
    }

    const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json(invoice);
  } catch (err) {
    console.error('createInvoice error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateInvoice(req, res) {
  try {
    const { status, paid_at, notes } = req.body;

    const existing = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found.' });

    await run('UPDATE invoices SET status=COALESCE(?,status), paid_at=COALESCE(?,paid_at), notes=COALESCE(?,notes) WHERE id=?',
      [status || null, paid_at || null, notes !== undefined ? notes : null, req.params.id]);

    if (status === 'paid' && !paid_at) {
      await run('UPDATE invoices SET paid_at = NOW() WHERE id = ?', [req.params.id]);
    }

    const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    res.json(invoice);
  } catch (err) {
    console.error('updateInvoice error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function payInvoice(req, res) {
  try {
    const existing = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found.' });

    await run('UPDATE invoices SET status = ?, paid_at = NOW() WHERE id = ?', ['paid', req.params.id]);
    const invoice = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    res.json(invoice);
  } catch (err) {
    console.error('payInvoice error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function downloadInvoicePDF(req, res) {
  try {
    const invoice = await queryOne(`
      SELECT i.*, c.name as client_name, c.address as client_address, c.phone as client_phone,
             u.username as staff_name, u.email as staff_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON i.staff_id = u.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);

    const getSetting = async (key, def) => {
      const r = await queryOne("SELECT value FROM settings WHERE `key` = ?", [key]);
      return r ? r.value : def;
    };

    const companyName = await getSetting('company_name', 'Avana Care Shift');
    const companyAddress = await getSetting('company_address', '');
    const companyPhone = await getSetting('company_phone', '');
    const companyEmail = await getSetting('company_email', '');
    const currency = await getSetting('currency_symbol', '$');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    doc.fontSize(24).font('Helvetica-Bold').text(companyName, 50, 50);
    doc.fontSize(10).font('Helvetica').text(companyAddress, 50, 80);
    doc.text(`Phone: ${companyPhone}`, 50, 95);
    doc.text(`Email: ${companyEmail}`, 50, 110);

    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoice.invoice_number}`, 400, 80, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 400, 95, { align: 'right' });
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 400, 110, { align: 'right' });

    doc.moveTo(50, 140).lineTo(545, 140).stroke();

    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, 160);
    doc.fontSize(10).font('Helvetica').text(invoice.client_name, 50, 178);
    doc.text(invoice.client_address || '', 50, 193);
    doc.text(`Phone: ${invoice.client_phone || ''}`, 50, 208);

    if (invoice.staff_name) {
      doc.fontSize(12).font('Helvetica-Bold').text('Caregiver:', 300, 160);
      doc.fontSize(10).font('Helvetica').text(invoice.staff_name, 300, 178);
      doc.text(invoice.staff_email || '', 300, 193);
    }

    const tableTop = 250;
    doc.moveTo(50, tableTop - 5).lineTo(545, tableTop - 5).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Qty', 350, tableTop, { width: 50, align: 'center' });
    doc.text('Rate', 410, tableTop, { width: 60, align: 'right' });
    doc.text('Amount', 480, tableTop, { width: 65, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    for (const item of items) {
      doc.text(item.description, 50, y);
      doc.text(String(item.quantity), 350, y, { width: 50, align: 'center' });
      doc.text(`${currency}${Number(item.rate).toFixed(2)}`, 410, y, { width: 60, align: 'right' });
      doc.text(`${currency}${Number(item.amount).toFixed(2)}`, 480, y, { width: 65, align: 'right' });
      y += 20;
    }

    doc.moveTo(350, y + 5).lineTo(545, y + 5).stroke();
    y += 15;
    doc.text('Subtotal:', 350, y, { width: 130, align: 'right' });
    doc.text(`${currency}${Number(invoice.subtotal).toFixed(2)}`, 480, y, { width: 65, align: 'right' });
    y += 20;
    doc.text(`Tax (${Number(invoice.tax_rate).toFixed(0)}%):`, 350, y, { width: 130, align: 'right' });
    doc.text(`${currency}${Number(invoice.tax).toFixed(2)}`, 480, y, { width: 65, align: 'right' });
    y += 20;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total:', 350, y, { width: 130, align: 'right' });
    doc.text(`${currency}${Number(invoice.total).toFixed(2)}`, 480, y, { width: 65, align: 'right' });

    y += 30;
    const statusColors = { paid: '#22c55e', pending: '#eab308', overdue: '#ef4444' };
    doc.fontSize(14).fillColor(statusColors[invoice.status] || '#000').text(`Status: ${invoice.status.toUpperCase()}`, 50, y);

    doc.fillColor('#666').fontSize(8).font('Helvetica');
    doc.text('Thank you for your business!', 50, 750, { align: 'center' });
    doc.text(`Generated by Avana Care Shift`, 50, 765, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('downloadInvoicePDF error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, payInvoice, downloadInvoicePDF };
