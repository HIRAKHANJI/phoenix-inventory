const ManufacturingProjectRepository = require('../repositories/ManufacturingProjectRepository');
const ManufacturingItemRepository = require('../repositories/ManufacturingItemRepository');
const InventoryItemRepository = require('../repositories/InventoryItemRepository');
const ManufacturingService = require('../services/ManufacturingService');
const ApiResponse = require('../utils/ApiResponse');

class ManufacturingController {
  _getService = (req) => {
    const projectRepo = new ManufacturingProjectRepository(req.knex);
    const itemRepo = new ManufacturingItemRepository(req.knex);
    const invItemRepo = new InventoryItemRepository(req.knex); 
    return new ManufacturingService(projectRepo, itemRepo, invItemRepo, req.knex);
  };

  _checkInpack = (req) => {
    if (req.company !== 'inpack') {
      throw { statusCode: 403, message: 'Manufacturing module is exclusive to Inpack Node.' };
    }
  };

  getProjects = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const data = await service.getAllProjects();
      res.json(ApiResponse.success('Projects retrieved.', data));
    } catch (err) { next(err); }
  };

  getProject = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const data = await service.getProjectDetail(req.params.id);
      res.json(ApiResponse.success('Project details retrieved.', data));
    } catch (err) { next(err); }
  };

  createProject = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const data = await service.createProject(req.body, req.user.id);
      res.status(201).json(ApiResponse.success('Project created.', data));
    } catch (err) { next(err); }
  };

  updateProject = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const data = await service.updateProject(req.params.id, req.body, req.user);
      res.json(ApiResponse.success('Project updated.', data));
    } catch (err) { next(err); }
  };

  updateStatus = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const data = await service.updateStatus(req.params.id, req.body.status, req.user);
      res.json(ApiResponse.success('Status updated.', data));
    } catch (err) { next(err); }
  };

  deleteProject = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      await service.deleteProject(req.params.id, req.user);
      res.json(ApiResponse.success('Project and associated records deleted.'));
    } catch (err) { next(err); }
  };

  addItem = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const { product_id, quantity_used, cost } = req.body;
      const data = await service.addItemToProject(req.params.id, product_id, quantity_used, cost, req.user);
      res.status(201).json(ApiResponse.success('Item added to project.', data));
    } catch (err) { next(err); }
  };

  removeItem = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      await service.removeItemFromProject(req.params.id, req.params.itemId, req.user);
      res.json(ApiResponse.success('Item removed from project.'));
    } catch (err) { next(err); }
  };

  updateItem = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const { quantity_used, cost } = req.body;
      const data = await service.updateItemQuantity(req.params.id, req.params.itemId, quantity_used, cost, req.user);
      res.json(ApiResponse.success('Item quantity updated.', data));
    } catch (err) { next(err); }
  };

  downloadReport = async (req, res, next) => {
    try {
      this._checkInpack(req);
      const service = this._getService(req);
      const buffer = await service.generatePdfReport(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=manufacturing-report-${req.params.id}.pdf`);
      res.send(buffer);
    } catch (err) { next(err); }
  };
}

module.exports = new ManufacturingController();
