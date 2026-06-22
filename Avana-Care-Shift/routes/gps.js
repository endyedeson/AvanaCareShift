const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const gc = require('../controllers/gpsController');

router.post('/', authenticate, requireRole('staff'), gc.logGPS);
router.get('/shift/:shiftId', authenticate, gc.getGPSByShift);
router.get('/history/:shiftId', authenticate, gc.getGPSHistory);

module.exports = router;
