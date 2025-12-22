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

// Create new bill
const createBill = async (req, res) => {
  try {
    const { items } = req.body;
    
    // Validate and calculate
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
      
      // Update stock
      product.stock -= item.quantity;
      await product.save();
    }
    
    const now = new Date();
    const billId = await generateBillId();
    const dayIdentifier = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    //const dayIdentifier = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    const bill = new Bill({
      billId,
      items: billItems,
      totalAmount,
      date: now,
      time,
      dayIdentifier
    });
    
    await bill.save();
    
    // Update active day
    let activeDay = await ActiveDay.findOne({ date: dayIdentifier });
    if (!activeDay) {
      activeDay = new ActiveDay({
        date: dayIdentifier,
        startedAt: now,
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

    console.log('=== DEBUG TODAY BILLS ===');
    console.log('Server thinks today is:', today);
    console.log('Server full date:', new Date());


    const bills = await Bill.find({ dayIdentifier: today }).sort({ createdAt: 1 });
  

    console.log('Found bills count:', bills.length);
    console.log('Bills:', bills.map(b => ({ id: b.billId, date: b.dayIdentifier })));



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

module.exports = {
  createBill,
  getTodayBills,
  getBillsByDate,
  getBillById,
  getPast30DaysBills
};
