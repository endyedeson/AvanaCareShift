const { getDb } = require('./db');

function createNotification(userId, title, message, type = 'info', link = null) {
  const db = getDb();
  db.prepare('INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)')
    .run(userId, title, message, type, link);
}

function getUnreadCount(userId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
  return row.count;
}

module.exports = { createNotification, getUnreadCount };
