const express = require('express');
const { 
  getDispatchOrders, 
  getDispatchOrder, 
  createDispatchOrder, 
  updateDispatchOrder, 
  deleteDispatchOrder,
  bulkDeleteDispatchOrders,
  bulkUpdateDispatchStatus,
  markOutForDelivery,
  markDelivered,
  downloadDispatchOrderPDF,
  getDispatchOrderETA,
  getTrackingDetails,
  updateTrackingLocation,
  completeTracking,
  lookupLocation
} = require('../controllers/dispatch');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public Tracking Routes
router.get('/track/:trackingId', getTrackingDetails);
router.put('/track/:trackingId/location', updateTrackingLocation);
router.put('/track/:trackingId/complete', completeTracking);

router.use(protect);

router.get('/lookup-location', lookupLocation);

router.route('/')
  .get(getDispatchOrders)
  .post(createDispatchOrder);

router.post('/bulk-delete', bulkDeleteDispatchOrders);
router.put('/bulk-status', bulkUpdateDispatchStatus);

router.route('/:id')
  .get(getDispatchOrder)
  .put(updateDispatchOrder)
  .delete(deleteDispatchOrder);

router.put('/:id/out-for-delivery', markOutForDelivery);
router.put('/:id/delivered', upload.single('deliveryNote'), markDelivered);
router.get('/:id/pdf', downloadDispatchOrderPDF);
router.get('/:id/eta', getDispatchOrderETA);

module.exports = router;
