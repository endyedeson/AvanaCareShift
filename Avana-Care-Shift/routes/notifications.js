const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const nc = require('../controllers/notificationController');

router.get('/', authenticate, nc.listNotifications);
router.get('/unread', authenticate, nc.getUnread);
router.put('/:id/read', authenticate, nc.markRead);
router.put('/read-all', authenticate, nc.markAllRead);

module.exports = router;
