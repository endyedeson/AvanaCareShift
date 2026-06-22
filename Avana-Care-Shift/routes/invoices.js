const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ic = require('../controllers/invoiceController');

router.get('/', authenticate, ic.listInvoices);
router.get('/:id', authenticate, ic.getInvoice);
router.post('/', authenticate, requireRole('admin'), ic.createInvoice);
router.put('/:id', authenticate, requireRole('admin'), ic.updateInvoice);
router.put('/:id/pay', authenticate, ic.payInvoice);
router.get('/:id/pdf', authenticate, ic.downloadInvoicePDF);

module.exports = router;
