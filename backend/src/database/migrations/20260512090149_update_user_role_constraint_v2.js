/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    try {
      // 1. Drop existing role check
      await knex.raw('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check"');
      
      // 2. Add the expanded role check including 'viewer' and 'pending'
      await knex.raw(`
        ALTER TABLE "users" 
        ADD CONSTRAINT "users_role_check" 
        CHECK (role IN ('super_admin', 'admin', 'user', 'viewer', 'pending'))
      `);
    } catch (err) {
      console.warn('Manual constraint update skipped or failed:', err.message);
    }
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check"');
  await knex.raw(`
    ALTER TABLE "users" 
    ADD CONSTRAINT "users_role_check" 
    CHECK (role IN ('super_admin', 'admin', 'user'))
  `);
};
