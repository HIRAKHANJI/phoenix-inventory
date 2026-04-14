// GET all users
const getAllUsers = async (req, res) => {
  try {
    let query = 'SELECT id, name, email, role, status, login_count, last_login_at, created_at, company_access FROM users';
    const params = [];

    if (req.user.role === 'admin') {
      query += ' WHERE role = $1';
      params.push('user');
    }

    query += ' ORDER BY created_at DESC';
    const result = await req.db.query(query, params);
    res.json(result.rows);
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
      if (targetRole !== 'user') {
        return res.status(403).json({ message: 'Security Protocol: Administrative oversight restricted to standard Personnel.' });
      }
      if (role && role !== 'user') {
        return res.status(403).json({ message: 'Security Protocol: Administrative access cannot modify clearance levels.' });
      }
    }

    if (req.user.role === 'super_admin') {
      // Super Admin can do almost anything, but let's prevent accidental self-demotion if they are the only ones
      // though for now we follow "full power"
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
    if (req.user.role === 'admin' && targetRole !== 'user') {
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

module.exports = { getAllUsers, updateUser, deleteUser, grantClearance };
