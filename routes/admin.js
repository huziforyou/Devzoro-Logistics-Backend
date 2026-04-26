const express = require('express');
const {
  approveVehicle,
  approveDriver,
  getPendingApprovals
} = require('../controllers/admin');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes here are protected and require admin or super-admin role
router.use(protect);
router.use(authorize('admin', 'super-admin'));

router.get('/pending-approvals', getPendingApprovals);
router.put('/approve-vehicle/:id', approveVehicle);
router.put('/approve-driver/:id', approveDriver);

module.exports = router;
