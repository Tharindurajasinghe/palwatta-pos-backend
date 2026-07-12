const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true,
    unique: true          // CUS001, CUS002 ...
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  addressLine1: {
    type: String,
    default: '',
    trim: true
  },
  addressLine2: {
    type: String,
    default: '',
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,         // must be unique
    trim: true
  },
  creditLimit: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

customerSchema.index({ name: 'text' });

module.exports = mongoose.model('Customer', customerSchema);