const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All routes require authentication + admin or super admin role
router.get('/', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.getAllUsers);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.deleteUser);
router.post('/:id/clearance', authMiddleware, roleMiddleware(['super_admin']), userController.grantClearance);

module.exports = router;
