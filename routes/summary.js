const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getDailySummary,
  createMonthlySummary,
  getMonthlySummary,
  getAllMonthlySummaries,
  getAvailableDates
} = require('../controllers/summaryController');

router.use(authenticateToken);

// Get daily summary by date
router.get('/daily/:date', getDailySummary);

// Create monthly summary
router.post('/monthly/create', createMonthlySummary);

// Get monthly summary by month
router.get('/monthly/:month', getMonthlySummary);

// Get all monthly summaries
router.get('/monthly', getAllMonthlySummaries);

// Get available dates for past 30 days (for check bill page)
router.get('/available-dates', getAvailableDates);

module.exports = router;