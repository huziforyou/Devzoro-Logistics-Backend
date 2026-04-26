const Driver = require('../models/Driver');
const DispatchOrder = require('../models/DispatchOrder');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

// @desc    Get all drivers
// @route   GET /api/drivers
// @access  Private
exports.getDrivers = async (req, res, next) => {
  try {
    // Only show Approved drivers in the main list
    const drivers = await Driver.find({ status: 'Approved' }).populate('assignedVehicle', 'plateNumber');
    
    // Add task counts and pending status
    const driversWithInfo = await Promise.all(drivers.map(async (d) => {
      const taskCount = await DispatchOrder.countDocuments({ assignedDriver: d._id });
      // Check if this driver has any pending vehicle assignment
      const pendingVehicle = await Vehicle.findOne({ pendingDriver: d._id, assignmentStatus: 'pending' });
      
      // Filter out assignedVehicle if its status is not approved
      const driverObj = d.toObject();
      const vehicle = await Vehicle.findById(d.assignedVehicle);
      if (vehicle && vehicle.assignmentStatus !== 'approved') {
        driverObj.assignedVehicle = null;
      }

      return { 
        ...driverObj, 
        taskCount, 
        hasPendingAssignment: !!pendingVehicle,
        pendingVehiclePlate: pendingVehicle ? pendingVehicle.plateNumber : null
      };
    }));

    res.status(200).json({ success: true, count: drivers.length, data: driversWithInfo });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single driver
// @route   GET /api/drivers/:id
// @access  Private
exports.getDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id).populate('assignedVehicle', 'plateNumber');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Fetch records/tasks for this driver
    const tasks = await DispatchOrder.find({ assignedDriver: driver._id })
      .populate('assignedVehicle', 'plateNumber')
      .sort('-createdAt');

    // Check for pending vehicle assignment
    const pendingVehicle = await Vehicle.findOne({ pendingDriver: driver._id, assignmentStatus: 'pending' });

    // Filter out assignedVehicle if its status is not approved
    const driverObj = driver.toObject();
    const vehicle = await Vehicle.findById(driver.assignedVehicle);
    if (vehicle && vehicle.assignmentStatus !== 'approved') {
      driverObj.assignedVehicle = null;
    }

    res.status(200).json({ 
      success: true, 
      data: {
        ...driverObj,
        tasks,
        pendingVehicle: pendingVehicle ? { _id: pendingVehicle._id, plateNumber: pendingVehicle.plateNumber } : null
      } 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create driver
// @route   POST /api/drivers
// @access  Private/Admin
exports.createDriver = async (req, res, next) => {
  try {
    const { assignedVehicle, ...driverData } = req.body;
    
    // Create driver without the vehicle assignment initially
    const driver = await Driver.create({ ...driverData, assignedVehicle: null, status: 'Pending' });

    // If a vehicle was selected, create a pending assignment in the Vehicle model
    if (assignedVehicle) {
      await Vehicle.findByIdAndUpdate(assignedVehicle, {
        pendingDriver: driver._id,
        assignmentStatus: 'pending'
      });
    }

    res.status(201).json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve driver
// @route   PUT /api/drivers/approve/:id
// @access  Private/Admin
exports.approveDriver = async (req, res, next) => {
  try {
    const { status } = req.body; // Expecting 'Approved' or 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const driver = await Driver.findByIdAndUpdate(req.params.id, { status }, {
      new: true,
      runValidators: true
    });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    res.status(200).json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

// @desc    Update driver
// @route   PUT /api/drivers/:id
// @access  Private/Admin
exports.updateDriver = async (req, res, next) => {
  try {
    const { assignedVehicle, ...driverData } = req.body;
    
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // If assignedVehicle is provided and different from current, it's a new pending request
    if (assignedVehicle && assignedVehicle !== (driver.assignedVehicle?.toString())) {
      // Check if there's already a pending request for this vehicle
      const vehicle = await Vehicle.findById(assignedVehicle);
      if (vehicle) {
        vehicle.pendingDriver = driver._id;
        vehicle.assignmentStatus = 'pending';
        await vehicle.save();
      }
    }

    // Update other driver fields
    Object.assign(driver, driverData);
    await driver.save();

    res.status(200).json({ success: true, data: driver });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete driver
// @route   DELETE /api/drivers/:id
// @access  Private/Admin
exports.deleteDriver = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    await driver.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
