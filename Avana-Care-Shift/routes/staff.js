const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const sc = require('../controllers/staffController');

router.get('/', authenticate, sc.listStaff);
router.get('/search', authenticate, requireRole('admin'), sc.searchAvailableStaff);
router.get('/:id', authenticate, sc.getStaff);
router.post('/', authenticate, requireRole('admin'), sc.createStaff);
router.put('/:id', authenticate, requireRole('admin'), sc.updateStaff);
router.delete('/:id', authenticate, requireRole('admin'), sc.deleteStaff);

module.exports = router;
