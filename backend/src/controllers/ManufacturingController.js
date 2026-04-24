const ApiResponse = require('../utils/ApiResponse');
const ManufacturingProjectRepository = require('../repositories/ManufacturingProjectRepository');
const ManufacturingItemRepository = require('../repositories/ManufacturingItemRepository');
const InventoryItemRepository = require('../repositories/InventoryItemRepository');
const ManufacturingService = require('../services/ManufacturingService');
const knex = require('../config/knex');

const projectRepo = new ManufacturingProjectRepository(knex);
const itemRepo = new ManufacturingItemRepository(knex);
const invItemRepo = new InventoryItemRepository(knex);
const service = new ManufacturingService(projectRepo, itemRepo, invItemRepo, knex);

// ── Projects
const getAllProjects = async (req, res, next) => {
  try {
    const projects = await service.getAllProjects();
    res.json(ApiResponse.success('Projects retrieved.', projects));
  } catch (err) { next(err); }
};

const createProject = async (req, res, next) => {
  try {
    const project = await service.createProject(req.body);
    res.status(201).json(ApiResponse.success('Project created.', project));
  } catch (err) { next(err); }
};

const getProjectDetail = async (req, res, next) => {
  try {
    const project = await service.getProjectDetail(req.params.id);
    res.json(ApiResponse.success('Project detail retrieved.', project));
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const project = await service.updateStatus(req.params.id, status);
    res.json(ApiResponse.success('Project status updated.', project));
  } catch (err) { next(err); }
};

// ── BOM Items
const addItem = async (req, res, next) => {
  try {
    const { inventory_item_id, quantity_used } = req.body;
    const result = await service.addItemToProject(req.params.id, inventory_item_id, quantity_used);
    res.status(201).json(ApiResponse.success('Item added to project.', result));
  } catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
  try {
    const { quantity_used } = req.body;
    const result = await service.updateItemInProject(req.params.id, req.params.itemId, quantity_used);
    res.json(ApiResponse.success('Item updated.', result));
  } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
  try {
    await service.removeItemFromProject(req.params.id, req.params.itemId);
    res.json(ApiResponse.success('Item removed from project. Stock restored.'));
  } catch (err) { next(err); }
};

// ── PDF Report
const downloadReport = async (req, res, next) => {
  try {
    const pdfBuffer = await service.generatePdfReport(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inpack-report-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

module.exports = { getAllProjects, createProject, getProjectDetail, updateStatus, addItem, updateItem, removeItem, downloadReport };
