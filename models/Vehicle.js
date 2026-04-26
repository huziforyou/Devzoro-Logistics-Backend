const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  plateNumber: {
    type: String,
    required: true,
    unique: true,
  },
  vehicleType: {
    type: String,
    enum: ['FlatBack', 'Tanker', 'Trailer', 'Dyna'],
    required: true,
  },
  assignedDriver: {
    type: mongoose.Schema.ObjectId,
    ref: 'Driver',
    required: false
  },
  assignmentStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
    required: false
  },
  pendingDriver: {
    type: mongoose.Schema.ObjectId,
    ref: 'Driver',
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: false
  },
  lastLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  approvalHistory: [{
    driver: { type: mongoose.Schema.ObjectId, ref: 'Driver' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.ObjectId, ref: 'User' }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Remove redundant fields from existing documents
VehicleSchema.remove('contactPerson');
VehicleSchema.remove('email');
VehicleSchema.remove('phone');
VehicleSchema.remove('address');
VehicleSchema.remove('vatNumber');

module.exports = mongoose.model('Vehicle', VehicleSchema);