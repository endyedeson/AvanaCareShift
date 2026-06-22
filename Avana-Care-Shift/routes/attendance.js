const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ac = require('../controllers/attendanceController');

router.get('/', authenticate, ac.listAttendance);
router.get('/my', authenticate, requireRole('staff'), ac.getMyAttendance);
router.post('/clock-in', authenticate, requireRole('staff'), ac.clockIn);
router.post('/clock-out', authenticate, requireRole('staff'), ac.clockOut);

module.exports = router;
