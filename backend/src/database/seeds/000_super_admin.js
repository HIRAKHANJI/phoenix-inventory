const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  const existing = await knex('users').where({ email: 'superadmin@phoenix-pack.com' }).first();
  if (existing) {
    return;
  }

  const hashedPassword = await bcrypt.hash('Phoenix786', 10);
  await knex('users').insert({
    name: 'Super Administrator',
    email: 'superadmin@phoenix-pack.com',
    password: hashedPassword,
    role: 'super_admin',
    status: 'active',
    login_count: 0,
    company_access: JSON.stringify({})
  });

  console.log('Seeded default super admin account: superadmin@phoenix-pack.com');
};
