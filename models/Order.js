const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true          // ORD001, ORD002 ...
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true            // NOT unique — this is a walk-in order customer
  },
  deliveryDate: {
    type: String,
    required: true        // YYYY-MM-DD
  },
  deliveryTime: {
    type: String,
    default: ''           // HH:mm
  },
  message: {
    type: String,
    default: ''
  },
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,                 // price agreed at order time
    originalSellingPrice: Number,
    total: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  completedAt: {
    type: Date,
    default: null
  },
  billId: {
    type: String,
    default: null        // the bill created when the order was completed
  }
}, { timestamps: true });

orderSchema.index({ status: 1, deliveryDate: 1 });

module.exports = mongoose.model('Order', orderSchema);