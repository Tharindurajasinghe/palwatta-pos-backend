const mongoose = require('mongoose');

const activeDaySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true // YYYY-MM-DD
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startedAt: Date,
  currentTotal: {
    type: Number,
    default: 0
  },
  currentProfit: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('ActiveDay', activeDaySchema);