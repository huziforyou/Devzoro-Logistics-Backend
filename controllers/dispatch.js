const DispatchOrder = require('../models/DispatchOrder');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { generateDispatchOrderPDF } = require('../utils/pdfHelper');
const { getIO } = require('../utils/socket');

// @desc    Lookup location by postal code
// @route   GET /api/dispatch/lookup-location
// @access  Private
exports.lookupLocation = async (req, res, next) => {
  try {
    const { postalcode, country } = req.query;

    if (!postalcode || !country) {
      return res.status(400).json({ success: false, error: 'Please provide postalcode and country' });
    }

    // Try Zippopotam.us first (Better for Postal Codes)
    try {
      const zipRes = await axios.get(`http://api.zippopotam.us/${country.toLowerCase()}/${postalcode}`);
      if (zipRes.data && zipRes.data.places && zipRes.data.places.length > 0) {
        const place = zipRes.data.places[0];
        const result = [{
          lat: place.latitude,
          lon: place.longitude,
          display_name: `${place['place name']}, ${place['state']}, ${zipRes.data.country}`
        }];
        return res.status(200).json({ success: true, data: result });
      }
    } catch (zipErr) {
      console.log('Zippopotam failed, falling back to Nominatim...');
    }

    // Fallback to Nominatim
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: `${postalcode}, ${country}`, // General query often works better than structured postalcode
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'Devzoro-Logistics-System/1.0 (Contact: admin@devzoro.com)'
      }
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error('Lookup error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to lookup location. Service might be busy, please try again in a moment.' });
  }
};

// Helper to calculate distance between two coordinates in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => deg * (Math.PI/180);

// Helper to emit dispatch updates
const emitDispatchUpdate = (event, data) => {
  try {
    const io = getIO();
    io.emit(event, data);
  } catch (error) {
    console.error('Socket error:', error.message);
  }
};

// @desc    Get tracking details (Public)
// @route   GET /api/dispatch/track/:trackingId
// @access  Public
exports.getTrackingDetails = async (req, res, next) => {
  try {
    const order = await DispatchOrder.findOne({ trackingId: req.params.trackingId })
      .populate('assignedDriver', 'fullName phoneNumber')
      .populate('assignedVehicle', 'plateNumber vehicleType');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Tracking ID not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update tracking location
// @route   PUT /api/dispatch/track/:trackingId/location
// @access  Public
exports.updateTrackingLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const order = await DispatchOrder.findOne({ trackingId: req.params.trackingId });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Tracking ID not found' });
    }

    if (order.status === 'Delivered' || order.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: 'Tracking is no longer active for this order' });
    }

    const now = new Date();

    // If this is the first coordinate, set startTrackingLocation
    if (!order.startTrackingLocation || !order.startTrackingLocation.lat) {
      order.startTrackingLocation = { lat, lng, timestamp: now };
      order.isTrackingActive = true;
      // Step 1: Status becomes "In Transit" on first scan/update
      order.status = 'In Transit';
    }

    // Calculate distance from previous location if exists
    if (order.currentLocation && order.currentLocation.lat) {
      const dist = calculateDistance(order.currentLocation.lat, order.currentLocation.lng, lat, lng);
      order.actualDistance = (order.actualDistance || 0) + dist;
    }

    order.currentLocation = { lat, lng, timestamp: now };
    
    // Add to tracking history
    order.trackingHistory.push({ lat, lng, timestamp: now });
    
    await order.save();

    const populatedOrder = await DispatchOrder.findById(order._id).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('dispatchUpdated', populatedOrder);
    emitDispatchUpdate('trackingLocationUpdate', { 
      orderId: order._id, 
      location: { lat, lng, timestamp: now },
      trackingHistory: order.trackingHistory,
      actualDistance: order.actualDistance 
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete tracking and mark as delivered
// @route   PUT /api/dispatch/track/:trackingId/complete
// @access  Public
exports.completeTracking = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const order = await DispatchOrder.findOne({ trackingId: req.params.trackingId });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Tracking ID not found' });
    }

    order.endTrackingLocation = { lat, lng, timestamp: new Date() };
    order.isTrackingActive = false;
    order.status = 'Delivered';
    order.deliveredDate = new Date();
    order.deliveredTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    await order.save();

    const populatedOrder = await DispatchOrder.findById(order._id).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('dispatchUpdated', populatedOrder);

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Download dispatch order PDF
// @route   GET /api/dispatch/:id/pdf
// @access  Private
exports.downloadDispatchOrderPDF = async (req, res, next) => {
  try {
    const order = await DispatchOrder.findById(req.params.id)
      .populate('assignedDriver')
      .populate('assignedVehicle');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const pdfBuffer = await generateDispatchOrderPDF(order, req);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Dispatch_${order.deliveryNoteNumber}.pdf`,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    next(error);
  }
};

// @desc    Get all dispatch orders
// @route   GET /api/dispatch
// @access  Private
exports.getDispatchOrders = async (req, res, next) => {
  try {
    let query;

    // Role & Permission based filtering
    const isAdmin = ['super-admin', 'admin', 'manager'].includes(req.user.role);
    
    // Explicitly check permissions object and its properties
    const hasCreatePerm = req.user.permissions && req.user.permissions.createDispatch === true;
    const hasEditPerm = req.user.permissions && req.user.permissions.editDispatch === true;
    const hasDispatchPrivileges = hasCreatePerm || hasEditPerm;

    if (isAdmin || hasDispatchPrivileges) {
      // Admins and users with dispatch permissions see everything
      query = DispatchOrder.find();
    } else if (req.user.role === 'vehicle' && req.user.vehicleProfile) {
      // Vehicle users only see their own
      query = DispatchOrder.find({ assignedVehicle: req.user.vehicleProfile });
    } else if (req.user.role === 'driver' && req.user.driverProfile) {
      // Drivers only see their own
      query = DispatchOrder.find({ assignedDriver: req.user.driverProfile });
    } else if (req.user.role === 'viewer') {
      // Viewers see everything
      query = DispatchOrder.find();
    } else {
      // If no specific conditions met, return empty query or limit strictly
      // For a "vehicle" role without a linked vehicle ID and no extra permissions, 
      // they shouldn't see anything.
      query = DispatchOrder.find({ _id: null }); 
    }

    const orders = await query
      .populate('assignedDriver')
      .populate('assignedVehicle')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single dispatch order
// @route   GET /api/dispatch/:id
// @access  Private
exports.getDispatchOrder = async (req, res, next) => {
  try {
    const order = await DispatchOrder.findById(req.params.id)
      .populate('assignedDriver')
      .populate('assignedVehicle');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Dispatch order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete dispatch orders
// @route   DELETE /api/dispatch/bulk-delete
// @access  Private (Admin/Super Admin)
exports.bulkDeleteDispatchOrders = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please provide an array of IDs' });
    }

    await DispatchOrder.deleteMany({ _id: { $in: ids } });

    emitDispatchUpdate('bulkDispatchDeleted', ids);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ETA for a dispatch order
// @route   GET /api/dispatch/:id/eta
// @access  Private
exports.getDispatchOrderETA = async (req, res, next) => {
  try {
    const order = await DispatchOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.currentLocation || !order.currentLocation.lat || !order.offloadingCoords || !order.offloadingCoords.lat) {
      return res.status(200).json({ 
        success: true, 
        data: { distanceKm: null, etaMinutes: null, reason: 'Coordinates missing' } 
      });
    }

    const distanceKm = calculateDistance(
      order.currentLocation.lat, 
      order.currentLocation.lng, 
      order.offloadingCoords.lat, 
      order.offloadingCoords.lng
    );

    // Assume average speed 60km/h
    const etaMinutes = Math.round((distanceKm / 60) * 60);

    res.status(200).json({ 
      success: true, 
      data: { 
        distanceKm: Number(distanceKm.toFixed(2)), 
        etaMinutes,
        currentLocation: order.currentLocation,
        destination: order.offloadingCoords
      } 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update dispatch status
// @route   PUT /api/dispatch/bulk-status
// @access  Private (Admin/Super Admin)
exports.bulkUpdateDispatchStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please provide an array of IDs' });
    }

    if (!status) {
      return res.status(400).json({ success: false, error: 'Please provide a status' });
    }

    await DispatchOrder.updateMany(
      { _id: { $in: ids } },
      { $set: { status, updatedBy: req.user.id } }
    );

    const updatedOrders = await DispatchOrder.find({ _id: { $in: ids } }).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('bulkDispatchUpdated', updatedOrders);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Create dispatch order
// @route   POST /api/dispatch
// @access  Private (Admin/Super Admin)
exports.createDispatchOrder = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;
    // Generate unique tracking ID
    req.body.trackingId = crypto.randomBytes(8).toString('hex');
    
    const order = await DispatchOrder.create(req.body);
    const populatedOrder = await DispatchOrder.findById(order._id).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('dispatchCreated', populatedOrder);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Update dispatch order
// @route   PUT /api/dispatch/:id
// @access  Private
exports.updateDispatchOrder = async (req, res, next) => {
  try {
    req.body.updatedBy = req.user.id;
    const order = await DispatchOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('assignedDriver').populate('assignedVehicle');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Dispatch order not found' });
    }

    emitDispatchUpdate('dispatchUpdated', order);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete dispatch order
// @route   DELETE /api/dispatch/:id
// @access  Private (Admin/Super Admin)
exports.deleteDispatchOrder = async (req, res, next) => {
  try {
    const order = await DispatchOrder.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Dispatch order not found' });
    }

    emitDispatchUpdate('dispatchDeleted', req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark dispatch order as Out for Delivery
// @route   PUT /api/dispatch/:id/out-for-delivery
// @access  Private
exports.markOutForDelivery = async (req, res, next) => {
  try {
    const { outForDeliveryDate, outForDeliveryTime } = req.body;
    const order = await DispatchOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Dispatch order not found' });
    }

    order.status = 'Out for Delivery';
    
    if (outForDeliveryDate && outForDeliveryTime) {
      order.outForDeliveryTime = new Date(`${outForDeliveryDate}T${outForDeliveryTime}`);
    } else {
      order.outForDeliveryTime = new Date();
    }
    
    order.updatedBy = req.user.id;

    await order.save();
    
    const populatedOrder = await DispatchOrder.findById(order._id).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('dispatchUpdated', populatedOrder);

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark dispatch order as Delivered
// @route   PUT /api/dispatch/:id/delivered
// @access  Private
exports.markDelivered = async (req, res, next) => {
  try {
    const { 
      deliveredDate, 
      deliveredTime, 
      receivedQuantity, 
      quantityStatus, 
      quantityDifference,
      deliveryNotes 
    } = req.body;
    
    const order = await DispatchOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Dispatch order not found' });
    }

    order.status = 'Delivered';
    order.deliveredDate = deliveredDate;
    order.deliveredTime = deliveredTime;
    order.receivedQuantity = receivedQuantity;
    order.quantityStatus = quantityStatus;
    order.quantityDifference = quantityDifference;
    order.deliveryNotes = deliveryNotes;
    order.updatedBy = req.user.id;

    if (req.file) {
      // 1. Convert to Base64 for database storage
      const fileBuffer = await fs.readFile(req.file.path);
      const base64Data = fileBuffer.toString('base64');
      
      order.deliveryNoteData = base64Data;
      order.deliveryNoteType = req.file.mimetype;
      order.deliveryNoteUrl = `/uploads/${req.file.filename}`; // Still keep URL for reference if needed

      // 2. Remove the temporary file from disk (Vercel/Serverless friendly)
      await fs.remove(req.file.path);
    }

    await order.save();
    
    const populatedOrder = await DispatchOrder.findById(order._id).populate('assignedDriver').populate('assignedVehicle');
    emitDispatchUpdate('dispatchUpdated', populatedOrder);

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
