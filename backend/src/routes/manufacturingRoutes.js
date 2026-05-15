const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const ctrl = require('../controllers/ManufacturingController');

const mfgAccess = [authMiddleware, roleMiddleware(['user', 'admin', 'super_admin'])];
const adminOnly = [authMiddleware, roleMiddleware(['admin', 'super_admin'])];

const projectValidation = [
  body('machine_name').notEmpty().withMessage('Machine name is required.'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number.'),
];

// Projects
router.get('/', mfgAccess, ctrl.getProjects);
router.post('/', [...mfgAccess, ...projectValidation, validateRequest], ctrl.createProject);
router.get('/:id', mfgAccess, ctrl.getProject);

router.put('/:id', [
  ...mfgAccess,
  ...projectValidation,
  validateRequest,
], ctrl.updateProject);

router.put('/:id/status', [
  ...mfgAccess,
  body('status').isIn(['not_started', 'active', 'closed']).withMessage('Invalid status.'),
  validateRequest,
], ctrl.updateStatus);

router.delete('/:id', mfgAccess, ctrl.deleteProject);

// BOM Items
router.post('/:id/items', [
  ...mfgAccess,
  body('product_id').isInt({ gt: 0 }).withMessage('product_id must be a valid integer.'),
  body('quantity_used').isFloat({ gt: 0 }).withMessage('quantity_used must be greater than 0.'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('cost must be a positive number.'),
  validateRequest,
], ctrl.addItem);

router.put('/:id/items/:itemId', [
  ...mfgAccess,
  body('quantity_used').isFloat({ gt: 0 }).withMessage('quantity_used must be greater than 0.'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('cost must be a positive number.'),
  validateRequest,
], ctrl.updateItem);

router.delete('/:id/items/:itemId', mfgAccess, ctrl.removeItem);

// PDF Report
router.get('/:id/report', mfgAccess, ctrl.downloadReport);

module.exports = router;
