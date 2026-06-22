const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const rc = require('../controllers/reportController');

router.get('/daily', authenticate, requireRole('admin'), rc.getDailyReport);
router.get('/weekly', authenticate, requireRole('admin'), rc.getWeeklyReport);
router.get('/monthly', authenticate, requireRole('admin'), rc.getMonthlyReport);
router.get('/revenue', authenticate, requireRole('admin'), rc.getRevenueReport);
router.get('/export/csv', authenticate, requireRole('admin'), rc.exportCSV);

module.exports = router;
