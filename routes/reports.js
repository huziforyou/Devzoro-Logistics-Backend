const express = require('express');
const router = express.Router();
const { getDashboardStats, getVehicleReports, getDriverReports } = require('../controllers/reports');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/vehicles', authorize('admin', 'super-admin'), getVehicleReports);
router.get('/drivers', authorize('admin', 'super-admin'), getDriverReports);

module.exports = router;