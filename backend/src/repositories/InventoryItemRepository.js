const BaseRepository = require('./BaseRepository');

class InventoryItemRepository extends BaseRepository {
  constructor(knex) {
    super(knex, 'inventory_items');
  }

  /**
   * Case-insensitive name search for autocomplete
   */
  async search(term) {
    return this.knex(this.tableName)
      .whereILike('name', `%${term}%`)
      .orderBy('name', 'asc')
      .limit(15);
  }

  /**
   * Adjust quantity by a signed delta inside a transaction.
   * Positive delta = add stock. Negative = deduct.
   * Throws if result would be negative.
   */
  async adjustQuantity(id, delta, trx) {
    const db = trx ? this.knex(this.tableName).transacting(trx) : this.knex(this.tableName);

    const item = await db.where({ id }).forUpdate().first();
    if (!item) throw { statusCode: 404, message: `Inventory item #${id} not found.` };

    const newQty = parseFloat(item.quantity) + parseFloat(delta);
    if (newQty < 0) {
      throw {
        statusCode: 400,
        message: `Insufficient stock for "${item.name}". Available: ${item.quantity}, requested: ${Math.abs(delta)}.`,
      };
    }

    await db.where({ id }).update({ quantity: newQty, updated_at: this.knex.fn.now() });
    return { ...item, quantity: newQty };
  }
}

module.exports = InventoryItemRepository;
