/**
 * Ensure quantity fields use decimal precision to support raw materials (kg, meters, etc.)
 */
exports.up = async function(knex) {
  // Update stock table quantity to decimal
  await knex.schema.alterTable('stock', table => {
    table.decimal('quantity', 15, 2).alter();
  });

  // Update inventory_transactions quantity to decimal
  await knex.schema.alterTable('inventory_transactions', table => {
    table.decimal('quantity', 15, 2).alter();
  });
};

exports.down = async function(knex) {
  // Rollback to integer if absolutely necessary, but decimal is safer for production
  await knex.schema.alterTable('stock', table => {
    table.integer('quantity').alter();
  });

  await knex.schema.alterTable('inventory_transactions', table => {
    table.integer('quantity').alter();
  });
};
