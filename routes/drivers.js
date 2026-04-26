const express = require('express');
const router = express.Router();
const { 
  getDrivers, 
  getDriver, 
  createDriver, 
  updateDriver, 
  deleteDriver,
  approveDriver
} = require('../controllers/drivers');
const { protect, authorize, hasPermission } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getDrivers)
  .post(hasPermission('manageDrivers'), createDriver);

router.put('/approve/:id', authorize('admin', 'super-admin'), approveDriver);

router.route('/:id')
  .get(getDriver)
  .put(hasPermission('manageDrivers'), updateDriver)
  .delete(hasPermission('manageDrivers'), deleteDriver);

module.exports = router;
