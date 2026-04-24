const BaseRepository = require('./BaseRepository');

class ManufacturingProjectRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'manufacturing_projects');
  }

  /**
   * Get a project with its full Bill of Materials (items + inventory details)
   */
  async findWithItems(id) {
    const project = await this.knex('manufacturing_projects').where({ id }).first();
    if (!project) return null;

    const items = await this.knex('manufacturing_items as mi')
      .join('inventory_items as ii', 'mi.inventory_item_id', '=', 'ii.id')
      .where('mi.project_id', id)
      .select(
        'mi.id',
        'mi.project_id',
        'mi.inventory_item_id',
        'mi.quantity_used',
        'mi.cost',
        'ii.name as item_name',
        'ii.category',
        'ii.unit',
        'ii.cost_per_unit',
        'ii.quantity as available_quantity'
      )
      .orderBy('mi.id', 'asc');

    const totalCostRow = await this.knex('manufacturing_items')
      .where({ project_id: id })
      .sum('cost as total')
      .first();

    return {
      ...project,
      items,
      total_cost: parseFloat(totalCostRow?.total || 0),
    };
  }

  /**
   * Get all projects with total_cost computed
   */
  async findAllWithCost() {
    return this.knex('manufacturing_projects as mp')
      .leftJoin('manufacturing_items as mi', 'mp.id', 'mi.project_id')
      .select('mp.*', this.knex.raw('COALESCE(SUM(mi.cost), 0) as total_cost'))
      .groupBy('mp.id')
      .orderBy('mp.created_at', 'desc');
  }
}

module.exports = ManufacturingProjectRepository;
