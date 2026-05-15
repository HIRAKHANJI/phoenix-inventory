const BaseRepository = require('./BaseRepository');

class InventoryItemRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'products');
  }

  async findAllWithStock() {
    return this.knex('products')
      .leftJoin('stock', 'products.id', '=', 'stock.product_id')
      .select(
        'products.*',
        this.knex.raw('COALESCE(SUM(stock.quantity), 0) as quantity')
      )
      .groupBy('products.id')
      .orderBy('products.name', 'asc');
  }

  async search(query) {
    return this.knex('products')
      .leftJoin('stock', 'products.id', '=', 'stock.product_id')
      .select(
        'products.*',
        this.knex.raw('COALESCE(SUM(stock.quantity), 0) as quantity')
      )
      .where('products.name', 'ILIKE', `%${query}%`)
      .orWhere('products.sku', 'ILIKE', `%${query}%`)
      .groupBy('products.id')
      .limit(10);
  }
}

module.exports = InventoryItemRepository;
