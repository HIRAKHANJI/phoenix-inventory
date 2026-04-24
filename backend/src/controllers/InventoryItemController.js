const ApiResponse = require('../utils/ApiResponse');
const InventoryItemRepository = require('../repositories/InventoryItemRepository');
const InventoryItemService = require('../services/InventoryItemService');
const knex = require('../config/knex');

const repo = new InventoryItemRepository(knex);
const service = new InventoryItemService(repo);

const getAll = async (req, res, next) => {
  try {
    const items = await service.getAll();
    res.json(ApiResponse.success('Inventory items retrieved.', items));
  } catch (err) { next(err); }
};

const search = async (req, res, next) => {
  try {
    const results = await service.search(req.query.q);
    res.json(ApiResponse.success('Search results.', results));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const item = await service.create(req.body);
    res.status(201).json(ApiResponse.success('Inventory item created.', item));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const item = await service.update(req.params.id, req.body);
    res.json(ApiResponse.success('Inventory item updated.', item));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await service.delete(req.params.id);
    res.json(ApiResponse.success('Inventory item deleted.'));
  } catch (err) { next(err); }
};

module.exports = { getAll, search, create, update, remove };
