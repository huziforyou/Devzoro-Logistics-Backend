const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');

// @desc    Approve vehicle
// @route   PUT /api/admin/approve-vehicle/:id
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

// @desc    Approve driver
// @route   PUT /api/admin/approve-driver/:id
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

// @desc    Get pending approvals
// @route   GET /api/admin/pending-approvals
// @access  Private/Admin
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const pendingVehicles = await Vehicle.find({ status: 'Pending' }).populate('assignedDriver', 'fullName');
    const pendingDrivers = await Driver.find({ status: 'Pending' }).populate('assignedVehicle', 'plateNumber');

    res.status(200).json({
      success: true,
      data: {
        vehicles: pendingVehicles,
        drivers: pendingDrivers
      }
    });
  } catch (error) {
    next(error);
  }
};
