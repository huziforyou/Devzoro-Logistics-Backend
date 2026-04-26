const express = require('express');
const router = express.Router();
const { 
  getDrivers, 
  getDriver, 
  createDriver, 
  updateDriver, 
  deleteDriver 
} = require('../controllers/drivers');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getDrivers)
  .post(createDriver);

router.route('/:id')
  .get(getDriver)
  .put(updateDriver)
  .delete(deleteDriver);

module.exports = router;
