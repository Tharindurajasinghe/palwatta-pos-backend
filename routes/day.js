const express = require('express');
const router = express.Router();
const {
  getCurrentDaySummary,
  endDay
} = require('../controllers/dayController');

// Get today's summary (up to now)
router.get('/current', getCurrentDaySummary);

// End day and create summary
router.post('/end', endDay);

module.exports = router;