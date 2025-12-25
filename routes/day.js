const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();
const {
  getCurrentDaySummary,
  endDay
} = require('../controllers/dayController');

router.use(authenticateToken);

// Get today's summary (up to now)
router.get('/current', getCurrentDaySummary);

// End day and create summary
router.post('/end', endDay);

module.exports = router;