const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    match: /^[0-9]{3}$/
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  buyingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  categoryId: {                   
    type: String,
    required: true,
    ref: 'Category'
  },
  expireDates: { type: [Date], default: [] },

  stockHistory: {
    type: [{
      oldStock: Number,
      newStock: Number,
      change: Number,        // newStock - oldStock (can be negative)
      changedAt: Date
    }],
    default: []
  },

  barcode: {
    type: String,
    trim: true,
    default: undefined     // undefined (not '') so the sparse index allows many blanks
  }


}, { timestamps: true });

// Index for case-insensitive name search
productSchema.index({ name: 'text' });
// NEW: barcode must be unique, but sparse so products without a barcode don't clash
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema);