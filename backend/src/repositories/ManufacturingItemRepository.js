const BaseRepository = require('./BaseRepository');

class ManufacturingItemRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'manufacturing_items');
  }

  async findByProjectAndItem(projectId, inventoryItemId) {
    return this.knex(this.tableName)
      .where({ project_id: projectId, inventory_item_id: inventoryItemId })
      .first();
  }
}

module.exports = ManufacturingItemRepository;
