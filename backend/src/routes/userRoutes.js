const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All routes require authentication
router.get('/', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.getAllUsers);
router.put('/:id', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.deleteUser);

// Approval flow — super_admin and admin can approve/reject pending users
router.put('/:id/approve', authMiddleware, roleMiddleware(['super_admin', 'admin']), userController.approveUser);
router.delete('/:id/reject', authMiddleware, roleMiddleware(['super_admin', 'admin']), userController.rejectUser);

// Status & Role management (reuse updateUser)
router.put('/:id/status', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.updateUser);
router.put('/:id/role', authMiddleware, roleMiddleware(['admin', 'super_admin']), userController.updateUser);

// Cross-domain clearance — super_admin only
router.post('/:id/clearance', authMiddleware, roleMiddleware(['super_admin']), userController.grantClearance);

module.exports = router;
