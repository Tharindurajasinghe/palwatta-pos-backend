const mongoose = require('mongoose');

const monthlySummarySchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    unique: true // Format: YYYY-MM (e.g., "2025-12")
  },
  monthName: {
    type: String,
    required: true // e.g., "December 2025"
  },
  items: [{
    productId: String,
    name: String,
    soldQuantity: Number,
    totalIncome: Number,
    profit: Number
  }],
  totalIncome: Number,
  totalProfit: Number,
  startDate: String,
  endDate: String,
  daysIncluded: Number
}, { timestamps: true });

module.exports = mongoose.model('MonthlySummary', monthlySummarySchema);