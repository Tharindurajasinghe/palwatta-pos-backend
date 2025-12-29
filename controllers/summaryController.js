const DailySummary = require('../models/DailySummary');
const MonthlySummary = require('../models/MonthlySummary');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const moment = require('moment-timezone');


// Get daily summary by date
const getDailySummary = async (req, res) => {
  try {
    const summary = await DailySummary.findOne({ date: req.params.date });
    if (!summary) {
      return res.status(404).json({ message: 'No summary found for this date' });
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create monthly summary
const createMonthlySummary = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo');
    const past30Days = moment(today).subtract(29, 'days');
    
    
    // Get all bills from past 30 days
    const bills = await Bill.find({
      date: { 
        $gte: past30Days.startOf('day').toDate(),
         $lte: today.endOf('day').toDate()
        }
    });
    
    if (bills.length === 0) {
      return res.status(400).json({ message: 'No bills found in the past 30 days' });
    }

    const itemsMap = new Map();
    let totalIncome = 0;
    let totalProfit = 0;

    for (const bill of bills) {
      for (const item of bill.items) {
        const product = await Product.findOne({ productId: item.productId });
        if (product) {
          const profit = (item.price - product.buyingPrice) * item.quantity;
          
          if (itemsMap.has(item.productId)) {
            const existing = itemsMap.get(item.productId);
            existing.soldQuantity += item.quantity;
            existing.totalIncome += item.total;
            existing.profit += profit;
          } else {
            itemsMap.set(item.productId, {
              productId: item.productId,
              name: item.name,
              soldQuantity: item.quantity,
              totalIncome: item.total,
              profit
            });
          }
          totalIncome += item.total;
          totalProfit += profit;
        }
      }
    }

    const month = today.format('YYYY-MM'); // YYYY-MM
    const monthName = today.format('MMMM YYYY');
    
    // Create or update monthly summary
    let monthlySummary = await MonthlySummary.findOne({ month });
    
    if (monthlySummary) {
      monthlySummary.items = Array.from(itemsMap.values());
      monthlySummary.totalIncome = totalIncome;
      monthlySummary.totalProfit = totalProfit;
      monthlySummary.startDate = past30Days.format('YYYY-MM-DD');
      monthlySummary.endDate = today.format('YYYY-MM-DD');
      monthlySummary.daysIncluded = bills.length > 0 ? 
      today.diff(moment(bills[0].date), 'days') + 1
  : 0;
       // Math.ceil((today - new Date(bills[0].date)) / (1000 * 60 * 60 * 24)) + 1 : 0;
    } else {
      monthlySummary = new MonthlySummary({
        month,
        monthName,
        items: Array.from(itemsMap.values()),
        totalIncome,
        totalProfit,
        startDate: past30Days.format('YYYY-MM-DD'),
        endDate: today.format('YYYY-MM-DD'),
        daysIncluded: bills.length > 0 ? 
        today.diff(moment(bills[0].date), 'days') + 1
  : 0
         // Math.ceil((today - new Date(bills[0].date)) / (1000 * 60 * 60 * 24)) + 1 : 0
      });
    }
    
    await monthlySummary.save();
    
    // Auto-delete old summaries (keep only last 12 months)
    const allSummaries = await MonthlySummary.find().sort({ month: -1 });
    if (allSummaries.length > 12) {
      const toDelete = allSummaries.slice(12);
      for (const summary of toDelete) {
        await MonthlySummary.deleteOne({ _id: summary._id });
      }
    }
    
    res.status(201).json(monthlySummary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get monthly summary by month
const getMonthlySummary = async (req, res) => {
  try {
    const summary = await MonthlySummary.findOne({ month: req.params.month });
    if (!summary) {
      return res.status(404).json({ message: 'No summary found for this month' });
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all monthly summaries
const getAllMonthlySummaries = async (req, res) => {
  try {
    const summaries = await MonthlySummary.find().sort({ month: -1 }).limit(12);
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get available dates for past 30 days (for check bill page)
const getAvailableDates = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo');
    const dates = [];
    
    // Add today
    dates.push({
      date: today.format('YYYY-MM-DD'),
      label: 'Today'
    });
    
    // Add past 29 days
    for (let i = 1; i <= 29; i++) {
  const d = moment(today).subtract(i, 'days');
  dates.push({
    date: d.format('YYYY-MM-DD'),
    label: d.format('MMM D, YYYY')
  });
}
    
    res.json(dates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getDailySummary,
  createMonthlySummary,
  getMonthlySummary,
  getAllMonthlySummaries,
  getAvailableDates
};