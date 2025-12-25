const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createBill,
  getTodayBills,
  getBillsByDate,
  getBillById,
  getPast30DaysBills,
  deleteBill
} = require('../controllers/billController');


// All routes need authentication
router.use(authenticateToken);

// Create new bill
router.post('/', createBill);

// Get all bills for today
router.get('/today', getTodayBills);

// Get bills by date
router.get('/date/:date', getBillsByDate);

// Get bill by ID
router.get('/:billId', getBillById);

// Get bills for past 30 days
router.get('/history/past30days', getPast30DaysBills);
// Delete Product
router.delete('/:billId', deleteBill);
// get all bills for check bills page
router.get('/debug/all-bills', async (req, res) => {
  const Bill = require('../models/Bill');
  const allBills = await Bill.find().sort({ createdAt: -1 }).limit(10);
  res.json(allBills.map(b => ({
    billId: b.billId,
    dayIdentifier: b.dayIdentifier,
    date: b.date,
    createdAt: b.createdAt
  })));
});

module.exports = router;
