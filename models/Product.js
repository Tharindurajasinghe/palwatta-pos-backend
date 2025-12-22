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
  }
}, { timestamps: true });

// Index for case-insensitive name search
productSchema.index({ name: 'text' });

module.exports = mongoose.model('Product', productSchema);