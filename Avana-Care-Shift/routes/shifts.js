const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const sc = require('../controllers/shiftController');

router.get('/', authenticate, sc.listShifts);
router.get('/:id', authenticate, sc.getShift);
router.post('/', authenticate, requireRole('admin'), sc.createShift);
router.put('/:id', authenticate, requireRole('admin'), sc.updateShift);
router.delete('/:id', authenticate, requireRole('admin'), sc.deleteShift);
router.put('/:id/assign', authenticate, requireRole('admin'), sc.assignShift);
router.put('/:id/approve', authenticate, requireRole('admin'), sc.approveShift);
router.post('/:id/pick', authenticate, requireRole('staff'), sc.pickShift);
router.post('/:id/reject', authenticate, requireRole('staff'), sc.rejectShift);
router.put('/:id/start', authenticate, requireRole('staff'), sc.startShift);
router.put('/:id/end', authenticate, requireRole('staff'), sc.endShift);

module.exports = router;
