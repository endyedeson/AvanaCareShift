const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const src = require('../controllers/shiftRequestController');

router.get('/', authenticate, src.listShiftRequests);
router.post('/', authenticate, src.createShiftRequest);
router.put('/:id', authenticate, requireRole('admin'), src.updateShiftRequest);

module.exports = router;
