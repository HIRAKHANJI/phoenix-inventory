// GET all users
const getAllUsers = async (req, res) => {
  try {
    let query = 'SELECT id, name, email, role, status, login_count, last_login_at, created_at, company_access FROM users';
    const params = [];

    if (req.user.role === 'admin') {
      query += ' WHERE role IN ($1, $2)';
      params.push('user', 'viewer');
    }

    query += ' ORDER BY CASE WHEN status = \'pending\' THEN 0 ELSE 1 END, created_at DESC';
    const result = await req.db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// APPROVE a pending user (super_admin/admin only)
const approveUser = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ['user', 'admin', 'viewer'];
  if (req.user.role === 'admin') {
    // Admins can only assign 'user' or 'viewer'
    if (!['user', 'viewer'].includes(role)) {
      return res.status(403).json({ message: 'Admin can only assign User or Viewer roles.' });
    }
  } else if (req.user.role === 'super_admin') {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` });
    }
  } else {
    return res.status(403).json({ message: 'Only administrators can approve users.' });
  }

  try {
    const userRes = await req.db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (userRes.rows[0].status !== 'pending') {
      return res.status(400).json({ message: 'This user has already been processed.' });
    }

    const result = await req.db.query(
      'UPDATE users SET status = $1, role = $2 WHERE id = $3 RETURNING id, name, email, role, status',
      ['active', role, id]
    );

    // Send notification about the approval
    const alertMsg = `User Approved: ${result.rows[0].name} has been granted "${role}" access by ${req.user.name}.`;
    await req.db.query(
      'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
      [alertMsg, req.user.name, 'USER_APPROVED']
    ).catch(() => {});

    res.json({ message: `User "${result.rows[0].name}" approved as ${role.toUpperCase()}.`, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// REJECT a pending user (delete from DB)
const rejectUser = async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await req.db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (userRes.rows[0].status !== 'pending') {
      return res.status(400).json({ message: 'Only pending users can be rejected.' });
    }

    const result = await req.db.query('DELETE FROM users WHERE id = $1 RETURNING name, email', [id]);
    res.json({ message: `Registration for "${result.rows[0].name}" has been rejected.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE user management
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, status, company_access } = req.body;

  try {
    const targetRes = await req.db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const targetRole = targetRes.rows[0].role;

    // Hierarchy Enforcement
    if (req.user.role === 'admin') {
      if (!['user', 'viewer'].includes(targetRole)) {
        return res.status(403).json({ message: 'Security Protocol: Administrative oversight restricted to standard Personnel.' });
      }
      if (role && !['user', 'viewer'].includes(role)) {
        return res.status(403).json({ message: 'Security Protocol: Administrative access cannot elevate to admin level.' });
      }
    }

    if (parseInt(id) === req.user.id) {
      if (role && role !== targetRole) return res.status(403).json({ message: 'Security Protocol: You cannot modify your own clearance level.' });
      if (status && status !== 'active') return res.status(403).json({ message: 'Security Protocol: You cannot suspend your own authorized session.' });
    }

    const queryParts = [];
    const values = [];
    let i = 1;

    if (role) {
      queryParts.push(`role = $${i++}`);
      values.push(role);
    }
    if (status) {
      queryParts.push(`status = $${i++}`);
      values.push(status);
    }
    if (company_access) {
      queryParts.push(`company_access = $${i++}`);
      values.push(JSON.stringify(company_access));
    }

    if (queryParts.length === 0) return res.status(400).json({ message: 'No update data provided.' });

    values.push(id);
    const result = await req.db.query(
      `UPDATE users SET ${queryParts.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, status, company_access`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE user
const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(403).json({ message: 'Security Protocol: Self-termination not permitted.' });
  }

  try {
    const targetRes = await req.db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const targetRole = targetRes.rows[0].role;
    if (req.user.role === 'admin' && !['user', 'viewer'].includes(targetRole)) {
      return res.status(403).json({ message: 'Admin access may only revoke standard users.' });
    }

    const result = await req.db.query('DELETE FROM users WHERE id = $1 RETURNING id, name', [id]);
    res.json({ message: `Access for "${result.rows[0].name}" has been revoked permanently.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GRANT clearance
const grantClearance = async (req, res) => {
  const { id } = req.params;
  const { company, hours } = req.body;

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(hours));

    const userRes = await req.db.query('SELECT company_access FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    let companyAccess = userRes.rows[0].company_access || {};
    companyAccess[company] = { expires_at: expiresAt.toISOString() };

    await req.db.query(
      'UPDATE users SET company_access = $1 WHERE id = $2',
      [JSON.stringify(companyAccess), id]
    );

    res.json({ message: `Clearance granted for ${company.toUpperCase()} for ${hours} hours.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllUsers, approveUser, rejectUser, updateUser, deleteUser, grantClearance };
