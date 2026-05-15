/**
 * Manufacturing Module Schema Migration
 * Creates: inventory_items, manufacturing_projects, manufacturing_items
 */

exports.up = async function (knex) {
  // 1. inventory_items — Rich item catalogue for manufacturing
  if (!(await knex.schema.hasTable('inventory_items'))) {
    await knex.schema.createTable('inventory_items', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('category', 20).notNullable()
        .checkIn(['raw_material', 'spare_part'], 'chk_inv_items_category');
      table.decimal('quantity', 12, 2).defaultTo(0);
      table.string('unit', 50).notNullable().defaultTo('pcs');
      table.decimal('cost_per_unit', 12, 2).defaultTo(0);
      table.timestamps(true, true);
    });
  }

  // 2. manufacturing_projects
  if (!(await knex.schema.hasTable('manufacturing_projects'))) {
    await knex.schema.createTable('manufacturing_projects', (table) => {
      table.increments('id').primary();
      table.string('machine_name', 255).notNullable();
      table.string('status', 20).notNullable().defaultTo('not_started')
        .checkIn(['not_started', 'active', 'closed'], 'chk_mfg_project_status');
      table.text('note').nullable();
      table.timestamps(true, true);
    });
  }

  // 3. manufacturing_items — Bill of Materials
  if (!(await knex.schema.hasTable('manufacturing_items'))) {
    await knex.schema.createTable('manufacturing_items', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().notNullable()
        .references('id').inTable('manufacturing_projects').onDelete('CASCADE');
      table.integer('inventory_item_id').unsigned().notNullable()
        .references('id').inTable('inventory_items');
      table.decimal('quantity_used', 12, 2).notNullable();
      table.decimal('cost', 12, 2).defaultTo(0);
      table.unique(['project_id', 'inventory_item_id'], 'uq_mfg_project_item');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('manufacturing_items');
  await knex.schema.dropTableIfExists('manufacturing_projects');
  await knex.schema.dropTableIfExists('inventory_items');
};
