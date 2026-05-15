
exports.up = async function (knex) {
  // Add created_by and budget to manufacturing_projects
  if (await knex.schema.hasTable('manufacturing_projects')) {
    await knex.schema.alterTable('manufacturing_projects', (table) => {
      table.integer('created_by').unsigned().nullable().references('id').inTable('users');
      table.decimal('budget', 12, 2).defaultTo(0);
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('manufacturing_projects')) {
    await knex.schema.alterTable('manufacturing_projects', (table) => {
      table.dropColumn('created_by');
      table.dropColumn('budget');
    });
  }
};
