const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    unique: true
  },
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
    buyingPrice: Number,
    originalSellingPrice: Number,
    total: Number,
     isWholesale: { type: Boolean, default: false }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  dayIdentifier: {
    type: String,
    required: true // Format: YYYY-MM-DD
  },
  cash: {
     type: Number,
     required : true
  },
  change : {
    type : Number,
    required : true
  },
  customerId: {
    type: String,
    default: null          // null = normal cash bill (all old bills)
  },
  customerName: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending'],
    default: 'paid'        // old bills stay 'paid'
  },
  paidAmount: {
    type: Number,
    default: 0             // how much of a credit bill is settled
  }
}, { timestamps: true });

billSchema.index({ dayIdentifier: 1, createdAt: -1 });
billSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);