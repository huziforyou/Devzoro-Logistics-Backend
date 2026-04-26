const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  iqamaNumber: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  vehicleType: {
    type: String,
    enum: ['FlatBack', 'Tanker', 'Trailer', 'Dyna'],
    required: false,
  },
  assignedVehicle: {
    type: mongoose.Schema.ObjectId,
    ref: 'Vehicle',
    required: false,
  },
  licenseExpiry: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
  },
  iqamaPdf: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Remove unused fields
DriverSchema.remove('name');
DriverSchema.remove('phone');
DriverSchema.remove('assignedVehicleId');
DriverSchema.remove('vehiclePlateNumber');
DriverSchema.remove('photo');
DriverSchema.remove('iqamaPdfType');

const Driver = mongoose.model('Driver', DriverSchema);

// Drop leftover indexes that might be causing duplicate errors (like email: null)
Driver.collection.dropIndex('email_1').catch(err => {});
Driver.collection.dropIndex('iqamaNumber_1').catch(err => {});

module.exports = Driver;