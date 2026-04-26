const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const DispatchOrder = require('../models/DispatchOrder');
const { sendSMS } = require('../utils/smsService');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private
exports.getVehicles = async (req, res, next) => {
  try {
    // Only show Approved vehicles in the main list
    const vehicles = await Vehicle.find({ status: 'Approved' })
      .populate('assignedDriver', 'fullName')
      .populate('pendingDriver', 'fullName');
    
    // Add record counts to each vehicle
    const vehiclesWithCounts = await Promise.all(vehicles.map(async (v) => {
      const recordCount = await DispatchOrder.countDocuments({ assignedVehicle: v._id });
      const vehicleObj = v.toObject();
      
      // If assignment is not approved, hide the assignedDriver from the object
      if (v.assignmentStatus !== 'approved') {
        vehicleObj.assignedDriver = null;
      }
      
      return { ...vehicleObj, recordCount };
    }));

    res.status(200).json({ success: true, count: vehicles.length, data: vehiclesWithCounts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private
exports.getVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('assignedDriver', 'fullName')
      .populate('pendingDriver', 'fullName');
      
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Fetch records for this vehicle
    const records = await DispatchOrder.find({ assignedVehicle: vehicle._id })
      .populate('assignedDriver', 'fullName')
      .sort('-createdAt');

    const vehicleObj = vehicle.toObject();
    if (vehicle.assignmentStatus !== 'approved') {
      vehicleObj.assignedDriver = null;
    }

    res.status(200).json({ 
      success: true, 
      data: {
        ...vehicleObj,
        records
      } 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign driver to vehicle (pending approval)
// @route   PUT /api/vehicles/:id/assign
// @access  Private
exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    vehicle.pendingDriver = driverId;
    vehicle.assignmentStatus = 'pending';
    await vehicle.save();

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve driver assignment
// @route   PUT /api/vehicles/:id/approve
// @access  Private/Admin
exports.approveAssignment = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    if (vehicle.assignmentStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending assignment' });
    }

    const driverId = vehicle.pendingDriver;
    vehicle.assignedDriver = driverId;
    vehicle.pendingDriver = null;
    vehicle.assignmentStatus = 'approved';
    await vehicle.save();

    if (driverId) {
      await Driver.findByIdAndUpdate(driverId, {
        assignedVehicle: vehicle._id
      });
      const driver = await Driver.findById(driverId);
      if (driver && driver.phoneNumber) {
        const smsMessage = `Devzoro: Dear ${driver.fullName}, your vehicle assignment has been approved. Vehicle Plate: ${vehicle.plateNumber}. You are now officially assigned to this vehicle.`;
        await sendSMS(driver.phoneNumber, smsMessage);
      }
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject driver assignment
// @route   PUT /api/vehicles/:id/reject
// @access  Private/Admin
exports.rejectAssignment = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    vehicle.pendingDriver = null;
    vehicle.assignmentStatus = 'none';
    await vehicle.save();

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Create vehicle
// @route   POST /api/vehicles
// @access  Private/Admin
exports.createVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.create({ ...req.body, status: 'Pending' });
    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private/Admin
exports.updateVehicle = async (req, res, next) => {
  try {
    // Prevent non-admins from changing the status
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      delete req.body.status;
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve vehicle
// @route   PUT /api/vehicles/approve/:id
// @access  Private/Admin
exports.approveVehicle = async (req, res, next) => {
  try {
    const { status } = req.body; // Expecting 'Approved' or 'Rejected'
    
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { status }, {
      new: true,
      runValidators: true
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vehicle location
// @route   PUT /api/vehicles/:id/location
// @access  Private
exports.updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, {
      lastLocation: { lat, lng, updatedAt: Date.now() }
    }, { new: true });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private/Admin
exports.deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    await vehicle.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
