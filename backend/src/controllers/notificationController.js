const getNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    let query = 'SELECT * FROM notifications';
    const params = [];

    // Protocol: Notification visibility is restricted by clearance level
    if (role === 'super_admin') {
      // Super Admin sees everything
      query += ' ORDER BY created_at DESC LIMIT 50';
    } else if (role === 'admin') {
      // Admins see everything except registration requests (USER_APPROVAL)
      query += " WHERE type != 'USER_APPROVAL' ORDER BY created_at DESC LIMIT 50";
    } else {
      // Standard users only see stock updates and general broadcast
      query += " WHERE type NOT IN ('USER_APPROVAL', 'USER_ACCESS', 'USER_APPROVED') ORDER BY created_at DESC LIMIT 50";
    }

    const notifications = await req.db.query(query, params);
    res.json(notifications.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    await req.db.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getNotifications, markAsRead };
