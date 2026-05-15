const BaseRepository = require('./BaseRepository');

class ManufacturingItemRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'manufacturing_items');
  }

  async findByProject(projectId) {
    return this.knex('manufacturing_items')
      .join('products', 'manufacturing_items.product_id', '=', 'products.id')
      .select(
        'manufacturing_items.*',
        'products.name as item_name',
        'products.unit',
        'products.category',
        'products.cost_per_unit'
      )
      .where({ project_id: projectId });
  }

  async findDuplicate(projectId, productId) {
    return this.knex('manufacturing_items')
      .where({ project_id: projectId, product_id: productId })
      .first();
  }
}

module.exports = ManufacturingItemRepository;
