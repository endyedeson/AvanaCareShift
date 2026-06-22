const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ac = require('../controllers/availabilityController');

router.get('/', authenticate, requireRole('staff'), (req, res) => ac.getAvailability(req, res));
router.get('/:staff_id', authenticate, ac.getAvailability);
router.post('/', authenticate, requireRole('staff'), ac.setAvailability);

module.exports = router;
