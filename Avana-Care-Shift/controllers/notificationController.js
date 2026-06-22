const { getDb } = require('../models/db');
const { getUnreadCount } = require('../models/notifications');

function listNotifications(req, res) {
  const db = getDb();
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(req.user.id);
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(req.user.id, parseInt(limit), offset);

  const unread = total.count - db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;

  res.json({ notifications, unreadCount: unread, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit) } });
}

function markRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Notification marked as read.' });
}

function markAllRead(req, res) {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All notifications marked as read.' });
}

function getUnread(req, res) {
  const count = getUnreadCount(req.user.id);
  res.json({ count });
}

module.exports = { listNotifications, markRead, markAllRead, getUnread };
