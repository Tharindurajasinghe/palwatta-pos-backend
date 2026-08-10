const Bill = require('../models/Bill');
const Product = require('../models/Product');
const ActiveDay = require('../models/ActiveDay');
const moment = require('moment-timezone');
const Customer = require('../models/Customer');                                  // NEW
const { recalcCustomerBalance } = require('./customerController');

// Generate next bill ID
async function generateBillId() {
  const lastBill = await Bill.findOne().sort({ billId: -1 });
  if (!lastBill) return '10001';
  
  const nextId = parseInt(lastBill.billId) + 1;
  return nextId.toString();
}

const createBill = async (req, res) => {
  try {
    const { items , cash, customerId } = req.body;   // customerId is NEW (optional)

    // ── NEW: if this is a customer (credit) bill, load the customer first ──
    let customer = null;
    if (customerId) {
      customer = await Customer.findOne({ customerId });
      if (!customer) {
        return res.status(400).json({ message: 'Customer not found' });
      }
    }

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

      // Use custom price if provided, otherwise use the product's selling price
      const sellingPrice = (item.customPrice !== undefined && item.customPrice !== null)
        ? parseFloat(item.customPrice)
        : product.sellingPrice;

      // Validate custom price is not below buying price
      if (sellingPrice < product.buyingPrice) {
        return res.status(400).json({
          message: `Price for "${product.name}" (Rs. ${sellingPrice}) cannot be less than buying price (Rs. ${product.buyingPrice})`
        });
      }
      
      const itemTotal = sellingPrice * item.quantity;
      totalAmount += itemTotal;
      
      billItems.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        price: sellingPrice,
        buyingPrice: product.buyingPrice,
        originalSellingPrice: product.sellingPrice,
        total: itemTotal,
        isWholesale: !!item.isWholesale
      });
      
      product.stock -= item.quantity;
      await product.save();
    }

    // ── NEW: credit limit check (stock was already deducted above, so restore it if we reject) ──
    if (customer) {
      const balanceAfter = customer.pendingBalance + totalAmount;
      if (balanceAfter > customer.creditLimit) {
        for (const bi of billItems) {
          const p = await Product.findOne({ productId: bi.productId });
          if (p) { p.stock += bi.quantity; await p.save(); }
        }
        return res.status(400).json({
          message: `Credit limit exceeded for ${customer.name}. Limit: Rs. ${customer.creditLimit.toFixed(2)} | Pending: Rs. ${customer.pendingBalance.toFixed(2)} | This bill: Rs. ${totalAmount.toFixed(2)} | Balance after: Rs. ${balanceAfter.toFixed(2)}`
        });
      }
    }

    // ── Cash handling: unchanged for normal bills, skipped for customer bills ──
    let cashPaid = 0;
    let change = 0;

    if (customer) {
      cashPaid = 0;      // nothing paid now — it's a loan
      change = 0;
    } else {
      if (cash < totalAmount) {
        return res.status(400).json({ message: 'Insufficient cash' });
      }
      cashPaid = cash;
      change = cash - totalAmount;
    }

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
      cash: cashPaid,
      change,
      dayIdentifier,
      // ── NEW ──
      customerId:    customer ? customer.customerId : null,
      customerName:  customer ? customer.name : '',
      paymentStatus: customer ? 'pending' : 'paid',
      paidAmount:    0
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

    // ── NEW: update the customer's pending balance ──
    if (customer) {
      await recalcCustomerBalance(customer.customerId);
    }
    
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
    if (bill.customerId) {
      await recalcCustomerBalance(bill.customerId);
    }

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