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
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getDrivers)
  .post(createDriver);

router.put('/approve/:id', authorize('admin'), approveDriver);

router.route('/:id')
  .get(getDriver)
  .put(updateDriver)
  .delete(deleteDriver);

module.exports = router;
