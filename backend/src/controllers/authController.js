const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const db = req.db;

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Register with status='pending' — super_admin must approve before login is allowed
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, role, status, login_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, status',
      [name, email, hashedPassword, 'user', 'pending', 0]
    );


    // Notify super_admin of the new registration request
    const alertMsg = `New Registration Request: ${name} (${email}) is awaiting approval.`;
    await db.query(
      'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
      [alertMsg, 'System', 'USER_APPROVAL']
    ).catch(() => {});

    res.status(201).json({
      message: 'Registration submitted successfully. Please wait for admin approval before logging in.',
      user: newUser.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = req.db;
    const company = req.company || 'phoenix';

    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Identity not found in current logistics node.' });
    }

    // Block pending users from logging in
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending approval. Please contact your administrator.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account access has been suspended. Contact Administration.' });
    }

    // Block users with 'pending' role (extra safety)
    if (user.role === 'pending') {
      return res.status(403).json({ message: 'Your account has not been assigned a role yet. Please wait for admin approval.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Security key verification failed.' });
    }

    // Professional Audit: Update login metrics
    const isFirstLogin = Number(user.login_count ?? 0) === 0;
    await db.query(
      'UPDATE users SET login_count = login_count + 1, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Automation: Alert admins of first-time access
    if (isFirstLogin) {
      const alertMsg = `New Personnel Access: ${user.name || user.email} authorized for ${company.toUpperCase()}`;
      await db.query(
        'INSERT INTO notifications (message, user_name, type) VALUES ($1, $2, $3)',
        [alertMsg, user.name || 'System', 'USER_ACCESS']
      ).catch(() => {});
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, company },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
      company,
      id: user.id
    });
  } catch (err) {
    console.error('Login Failure:', err);
    res.status(500).json({ error: 'Internal Security Error' });
  }
};

module.exports = {
  register,
  login
};