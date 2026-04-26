const mongoose = require('mongoose');

const dispatchOrderSchema = new mongoose.Schema({
  loadingDateTime: {
    type: Date,
    required: [true, 'Please provide loading date and time'],
  },
  loadingFrom: {
    type: String,
    required: [true, 'Please provide loading location'],
  },
  offloadingTo: {
    type: String,
    required: [true, 'Please provide offloading location'],
  },
  materialDescription: String,
  deliveryNoteNumber: {
    type: String,
    required: [true, 'Please provide delivery note number'],
  },
  customerName: String,
  customerVAT: String,
  materialQuantity: String,
  assignedDriver: {
    type: mongoose.Schema.ObjectId,
    ref: 'Driver',
    required: [true, 'Please assign a driver'],
  },
  assignedVehicle: {
    type: mongoose.Schema.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Please assign a vehicle'],
  },
  vehiclePlateNumber: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: String,
  status: {
    type: String,
    enum: ['Pending', 'Picked Up', 'Out for Delivery', 'In Transit', 'Pending Approval', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  outForDeliveryTime: {
    type: Date
  },
  deliveredDate: {
    type: Date
  },
  deliveredTime: {
    type: String
  },
  deliveryNoteUrl: {
    type: String
  },
  deliveryNoteData: {
    type: String // Store as Base64 string
  },
  deliveryNoteType: {
    type: String // MIME type (e.g., application/pdf)
  },
  receivedQuantity: {
    type: String
  },
  quantityStatus: {
    type: String,
    enum: ['Exact', 'Shortage', 'Excess'],
    default: 'Exact'
  },
  quantityDifference: {
    type: String
  },
  deliveryNotes: {
    type: String
  },
  distance: {
    type: String // e.g. "25 km"
  },
  estimatedTime: {
    type: String // e.g. "45 mins"
  },
  trackingId: {
    type: String,
    unique: true
  },
  startTrackingLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date
  },
  currentLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date
  },
  endTrackingLocation: {
    lat: Number,
    lng: Number,
    timestamp: Date
  },
  trackingHistory: [{
    lat: Number,
    lng: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  actualDistance: {
    type: Number, // in km
    default: 0
  },
  isTrackingActive: {
    type: Boolean,
    default: false
  },
  loadingCoords: {
    lat: Number,
    lng: Number
  },
  offloadingCoords: {
    lat: Number,
    lng: Number
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true,
});

const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);

// Drop leftover unique indexes if they exist
DispatchOrder.collection.dropIndex('deliveryNoteNumber_1').catch(err => {});

module.exports = DispatchOrder;
