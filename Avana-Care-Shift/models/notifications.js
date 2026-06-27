const { query } = require('./db');

async function createNotification(userId, title, message, type = 'info', link = null) {
  await query(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, link]
  );
}

async function getUnreadCount(userId) {
  const rows = await query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return rows[0].count;
}

module.exports = { createNotification, getUnreadCount };
