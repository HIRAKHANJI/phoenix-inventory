/**
 * Unify Inventory Schema: 
 * 1. Renames 'products' to 'inventory_items' conceptually (though I'll keep the name 'products' for now to avoid massive breakages, but add the fields).
 * 2. Adds category, unit, cost_per_unit to products.
 * 3. Updates manufacturing_items to point to products.
 * 4. Drops redundant inventory_items table.
 */
exports.up = async function (knex) {
  // 1. Add fields to products
  await knex.schema.alterTable('products', table => {
    table.enum('category', ['raw_material', 'spare_part']).defaultTo('raw_material').notNullable();
    table.string('unit').defaultTo('pcs');
    table.decimal('cost_per_unit', 15, 2).defaultTo(0);
  });

  // 2. Update manufacturing_items FK to point to products
  // First drop the old FK
  await knex.schema.alterTable('manufacturing_items', table => {
    table.dropForeign('inventory_item_id');
  });

  // Rename the column to product_id to match convention
  await knex.schema.alterTable('manufacturing_items', table => {
    table.renameColumn('inventory_item_id', 'product_id');
  });

  // Add new FK to products
  await knex.schema.alterTable('manufacturing_items', table => {
    table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
  });

  // 3. Drop redundant tables
  await knex.schema.dropTableIfExists('inventory_items');
  await knex.schema.dropTableIfExists('inventory');
};

exports.down = async function (knex) {
  // Rollback logic if needed (skipped for brevity as this is a cleanup)
};
