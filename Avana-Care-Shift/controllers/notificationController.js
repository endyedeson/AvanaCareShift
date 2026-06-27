const { query, queryOne, run } = require('../models/db');
const { getUnreadCount } = require('../models/notifications');

async function listNotifications(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const total = await queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?', [req.user.id]);
    const notifications = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, parseInt(limit), offset]);

    const unread = total.count - (await queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id])).count;

    res.json({ notifications, unreadCount: unread, pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('listNotifications error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markRead(req, res) {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markAllRead(req, res) {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getUnread(req, res) {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error('getUnread error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { listNotifications, markRead, markAllRead, getUnread };
