const BaseRepository = require('./BaseRepository');

class ManufacturingProjectRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'manufacturing_projects');
  }

  async findAllWithCost() {
    return this.knex('manufacturing_projects')
      .leftJoin('users', 'manufacturing_projects.created_by', '=', 'users.id')
      .select(
        'manufacturing_projects.*',
        'users.name as creator_name',
        'users.email as creator_email',
        this.knex('manufacturing_items')
          .join('products', 'manufacturing_items.product_id', 'products.id')
          .whereRaw('manufacturing_items.project_id = manufacturing_projects.id')
          .sum(this.knex.raw('manufacturing_items.quantity_used * manufacturing_items.cost'))
          .as('total_cost')
      )
      .orderBy('manufacturing_projects.created_at', 'desc');
  }

  async findWithItems(id) {
    const project = await this.knex('manufacturing_projects')
      .leftJoin('users', 'manufacturing_projects.created_by', '=', 'users.id')
      .select(
        'manufacturing_projects.*',
        'users.name as creator_name',
        'users.email as creator_email',
        this.knex('manufacturing_items')
          .join('products', 'manufacturing_items.product_id', 'products.id')
          .whereRaw('manufacturing_items.project_id = manufacturing_projects.id')
          .sum(this.knex.raw('manufacturing_items.quantity_used * manufacturing_items.cost'))
          .as('total_cost')
      )
      .where('manufacturing_projects.id', id)
      .first();

    if (project) {
      project.items = await this.knex('manufacturing_items')
        .join('products', 'manufacturing_items.product_id', '=', 'products.id')
        .select(
          'manufacturing_items.*',
          'products.name as item_name',
          'products.unit',
          'products.category',
          'products.cost_per_unit'
        )
        .where({ project_id: id });
    }

    return project;
  }
}

module.exports = ManufacturingProjectRepository;
