const mongoose = require('mongoose');

const customerPaymentSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  note: {
    type: String,
    default: ''
  },
  paymentDate: {
    type: Date,
    required: true
  },
  dayIdentifier: {
    type: String,
    required: true      // YYYY-MM-DD
  },
  recordedBy: {
    type: String,
    default: 'user'
  }
}, { timestamps: true });

customerPaymentSchema.index({ customerId: 1, paymentDate: -1 });

module.exports = mongoose.model('CustomerPayment', customerPaymentSchema);