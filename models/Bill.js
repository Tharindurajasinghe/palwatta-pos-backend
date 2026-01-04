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
    total: Number
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
  }
}, { timestamps: true });

billSchema.index({ dayIdentifier: 1, createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);