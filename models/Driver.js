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
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  iqamaPdf: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Driver = mongoose.model('Driver', DriverSchema);

// Drop leftover indexes that might be causing duplicate errors (like email: null)
Driver.collection.dropIndex('email_1').catch(err => {});
Driver.collection.dropIndex('name_1').catch(err => {});
Driver.collection.dropIndex('phone_1').catch(err => {});
Driver.collection.dropIndex('address_1').catch(err => {});

module.exports = Driver;