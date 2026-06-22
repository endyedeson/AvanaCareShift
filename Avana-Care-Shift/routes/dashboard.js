const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const dc = require('../controllers/dashboardController');

router.get('/admin', authenticate, requireRole('admin'), dc.getAdminDashboard);
router.get('/staff', authenticate, requireRole('staff'), dc.getStaffDashboard);
router.get('/client', authenticate, requireRole('client'), dc.getClientDashboard);

module.exports = router;
