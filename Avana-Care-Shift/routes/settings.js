const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const sc = require('../controllers/settingsController');

router.get('/', authenticate, sc.getSettings);
router.put('/', authenticate, requireRole('admin'), sc.updateSettings);
router.post('/backup', authenticate, requireRole('admin'), sc.backupDatabase);
router.post('/restore', authenticate, requireRole('admin'), sc.restoreDatabase);
router.get('/backups', authenticate, requireRole('admin'), sc.listBackups);

module.exports = router;
