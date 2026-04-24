const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validateRequest } = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const ctrl = require('../controllers/InventoryItemController');

const adminOnly = [authMiddleware, roleMiddleware(['admin', 'super_admin'])];
const allAuth   = [authMiddleware, roleMiddleware(['admin', 'super_admin', 'user'])];

router.get('/', allAuth, ctrl.getAll);
router.get('/search', allAuth, ctrl.search);

router.post('/', [
  ...adminOnly,
  body('name').notEmpty().withMessage('Name is required.'),
  body('category').isIn(['raw_material', 'spare_part']).withMessage('Category must be raw_material or spare_part.'),
  body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be >= 0.'),
  body('cost_per_unit').optional().isFloat({ min: 0 }).withMessage('Cost must be >= 0.'),
  validateRequest,
], ctrl.create);

router.put('/:id', [
  ...adminOnly,
  body('category').optional().isIn(['raw_material', 'spare_part']),
  body('quantity').optional().isFloat({ min: 0 }),
  body('cost_per_unit').optional().isFloat({ min: 0 }),
  validateRequest,
], ctrl.update);

router.delete('/:id', adminOnly, ctrl.remove);

module.exports = router;
