const BaseService = require('./BaseService');

const VALID_CATEGORIES = ['raw_material', 'spare_part'];

class InventoryItemService extends BaseService {
  constructor(inventoryItemRepository) {
    super(inventoryItemRepository);
  }

  async create(data) {
    const { name, category, quantity = 0, unit = 'pcs', cost_per_unit = 0 } = data;
    if (!name || !name.trim()) throw { statusCode: 400, message: 'Item name is required.' };
    if (!VALID_CATEGORIES.includes(category)) {
      throw { statusCode: 400, message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}.` };
    }
    if (quantity < 0) throw { statusCode: 400, message: 'Quantity cannot be negative.' };
    if (cost_per_unit < 0) throw { statusCode: 400, message: 'Cost per unit cannot be negative.' };

    return this.repository.create({ name: name.trim(), category, quantity, unit, cost_per_unit });
  }

  async update(id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) throw { statusCode: 404, message: 'Inventory item not found.' };

    const { name, category, quantity, unit, cost_per_unit } = data;
    if (category && !VALID_CATEGORIES.includes(category)) {
      throw { statusCode: 400, message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}.` };
    }
    if (quantity !== undefined && quantity < 0) throw { statusCode: 400, message: 'Quantity cannot be negative.' };

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (quantity !== undefined) updates.quantity = quantity;
    if (unit !== undefined) updates.unit = unit;
    if (cost_per_unit !== undefined) updates.cost_per_unit = cost_per_unit;
    updates.updated_at = new Date();

    return this.repository.update(id, updates);
  }

  async search(term) {
    if (!term || !term.trim()) return [];
    return this.repository.search(term.trim());
  }
}

module.exports = InventoryItemService;
