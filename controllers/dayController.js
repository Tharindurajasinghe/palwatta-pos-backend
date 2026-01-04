const ActiveDay = require('../models/ActiveDay');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const DailySummary = require('../models/DailySummary');
const moment = require('moment-timezone');

// Get today's summary (up to now)
const getCurrentDaySummary = async (req, res) => {
  try {
    
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today });

    const itemsMap = new Map();
    let totalSales = 0;
    let totalProfit = 0;
    
    for (const bill of bills) {
      totalSales += bill.totalAmount;
      
      for (const item of bill.items) {
        const product = await Product.findOne({ productId: item.productId });
        if (product) {
          const profit = (item.price - product.buyingPrice) * item.quantity;
          totalProfit += profit;

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
        }
      }
    }

    
    
    res.json({
      date: today,
      totalSales,
      totalProfit,
      billCount: bills.length,
      items: Array.from(itemsMap.values()),
      bills
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// End day and create summary
const endDay = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today });
    
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

    const summary = await DailySummary.create({
      date: today,
      items: Array.from(itemsMap.values()),
      totalIncome,
      totalProfit,
      endedAt: moment().tz('Asia/Colombo').toDate()
    });

    // Mark day as ended
    const activeDay = await ActiveDay.findOne({ date: today });
    if (activeDay) {
      activeDay.isActive = false;
      await activeDay.save();
    }

    res.json(summary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getCurrentDaySummary,
  endDay
};
