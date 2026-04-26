const express = require('express');
const router = express.Router();
const { 
  getVehicles, 
  getVehicle, 
  createVehicle, 
  updateVehicle, 
  deleteVehicle,
  assignDriver,
  approveAssignment,
  rejectAssignment,
  updateLocation,
  approveVehicle
} = require('../controllers/vehicles');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getVehicles)
  .post(createVehicle);

router.put('/approve/:id', authorize('admin'), approveVehicle);

router.route('/:id')
  .get(getVehicle)
  .put(updateVehicle)
  .delete(deleteVehicle);

router.put('/:id/assign', assignDriver);
router.put('/:id/approve', approveAssignment);
router.put('/:id/reject', rejectAssignment);
router.put('/:id/location', updateLocation);

module.exports = router;
