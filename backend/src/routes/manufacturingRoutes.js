const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const ctrl = require('../controllers/ManufacturingController');

const adminOnly = [authMiddleware, roleMiddleware(['admin', 'super_admin'])];

// Projects
router.get('/', adminOnly, ctrl.getAllProjects);
router.post('/', [
  ...adminOnly,
  body('machine_name').notEmpty().withMessage('Machine name is required.'),
  validateRequest,
], ctrl.createProject);
router.get('/:id', adminOnly, ctrl.getProjectDetail);
router.put('/:id/status', [
  ...adminOnly,
  body('status').isIn(['not_started', 'active', 'closed']).withMessage('Invalid status.'),
  validateRequest,
], ctrl.updateStatus);

// BOM Items
router.post('/:id/items', [
  ...adminOnly,
  body('inventory_item_id').isInt({ gt: 0 }).withMessage('inventory_item_id must be a valid integer.'),
  body('quantity_used').isFloat({ gt: 0 }).withMessage('quantity_used must be greater than 0.'),
  validateRequest,
], ctrl.addItem);

router.put('/:id/items/:itemId', [
  ...adminOnly,
  body('quantity_used').isFloat({ gt: 0 }).withMessage('quantity_used must be greater than 0.'),
  validateRequest,
], ctrl.updateItem);

router.delete('/:id/items/:itemId', adminOnly, ctrl.removeItem);

// PDF Report
router.get('/:id/report', adminOnly, ctrl.downloadReport);

module.exports = router;
