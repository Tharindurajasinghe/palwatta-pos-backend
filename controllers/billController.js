const Bill = require('../models/Bill');
const Product = require('../models/Product');
const ActiveDay = require('../models/ActiveDay');
const moment = require('moment-timezone');

// Generate next bill ID
async function generateBillId() {
  const lastBill = await Bill.findOne().sort({ billId: -1 });
  if (!lastBill) return '10001';
  
  const nextId = parseInt(lastBill.billId) + 1;
  return nextId.toString();
}

const createBill = async (req, res) => {
  try {
    const { items , cash} = req.body;
    
    let totalAmount = 0;
    const billItems = [];
    
    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(400).json({ message: `Product ${item.productId} not found` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }
      
      const itemTotal = product.sellingPrice * item.quantity;
      totalAmount += itemTotal;
      
      billItems.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        price: product.sellingPrice,
        total: itemTotal
      });
      
      product.stock -= item.quantity;
      await product.save();
    }
    if (cash < totalAmount) {
      return res.status(400).json({ message: 'Insufficient cash' });
    }

    const change = cash - totalAmount;

    
    // Use Sri Lanka timezone for everything
    const now = moment().tz('Asia/Colombo');
    const billId = await generateBillId();
    const dayIdentifier = now.format('YYYY-MM-DD');
    const time = now.format('hh:mm A');
    
    const bill = new Bill({
      billId,
      items: billItems,
      totalAmount,
      date: now.toDate(),
      time,
      cash,
      change,
      dayIdentifier
    });
    
    await bill.save();
    
    let activeDay = await ActiveDay.findOne({ date: dayIdentifier });
    if (!activeDay) {
      activeDay = new ActiveDay({
        date: dayIdentifier,
        startedAt: now.toDate(),
        currentTotal: totalAmount
      });
    } else {
      activeDay.currentTotal += totalAmount;
    }
    await activeDay.save();
    
    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all bills for today
const getTodayBills = async (req, res) => {
  try {
    //const today = new Date().toISOString().split('T')[0];
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today }).sort({ createdAt: 1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bills by date
const getBillsByDate = async (req, res) => {
  try {
    const bills = await Bill.find({ dayIdentifier: req.params.date }).sort({ createdAt: 1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bill by ID
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne({ billId: req.params.billId });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bills for past 30 days
const getPast30DaysBills = async (req, res) => {
  try {
    const today = new Date();
    const past30Days = new Date(today);
    past30Days.setDate(past30Days.getDate() - 29);
    
    const bills = await Bill.find({
      date: { $gte: past30Days, $lte: today }
    }).sort({ date: -1 });
    
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete bill by billId
const deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await Bill.findOne({ billId });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Restore stock
    for (const item of bill.items) {
      const product = await Product.findOne({ productId: item.productId });
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Update ActiveDay if today
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    if (bill.dayIdentifier === today) {
      const activeDay = await ActiveDay.findOne({ date: today });
      if (activeDay) {
        activeDay.currentTotal -= bill.totalAmount;
        if (activeDay.currentTotal < 0) activeDay.currentTotal = 0;
        await activeDay.save();
      }
    }

    // Delete the bill
    await bill.deleteOne();

    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



module.exports = {
  createBill,
  getTodayBills,
  getBillsByDate,
  getBillById,
  getPast30DaysBills,
  deleteBill
};
