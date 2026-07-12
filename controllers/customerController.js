const Customer = require('../models/Customer');
const CustomerPayment = require('../models/CustomerPayment');
const Bill = require('../models/Bill');
const moment = require('moment-timezone');

const TZ = 'Asia/Colombo';

// ─── Generate next customer ID (CUS001, CUS002 ...) ──────────────────────────
const getNextCustomerId = async () => {
  const last = await Customer.findOne().sort({ customerId: -1 });
  if (!last) return 'CUS001';
  const lastNum = parseInt(last.customerId.replace('CUS', ''), 10);
  return `CUS${String(lastNum + 1).padStart(3, '0')}`;
};

// ─── Recalculate a customer's pending balance from their unpaid bills ────────
// Exported — billController uses it too.
const recalcCustomerBalance = async (customerId) => {
  if (!customerId) return 0;

  const pendingBills = await Bill.find({ customerId, paymentStatus: 'pending' });
  const pending = pendingBills.reduce(
    (sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)),
    0
  );

  const customer = await Customer.findOne({ customerId });
  if (customer) {
    customer.pendingBalance = Math.max(0, parseFloat(pending.toFixed(2)));
    await customer.save();
  }
  return Math.max(0, parseFloat(pending.toFixed(2)));
};

// ─── Get all customers ───────────────────────────────────────────────────────
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Search customers by name / phone / customerId ───────────────────────────
const searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      const all = await Customer.find().sort({ name: 1 }).limit(10);
      return res.json(all);
    }
    const q = query.trim();
    const customers = await Customer.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { customerId: { $regex: q, $options: 'i' } }
      ]
    }).limit(10);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Get one customer + stats ────────────────────────────────────────────────
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const totalBills = await Bill.countDocuments({ customerId: customer.customerId });

    res.json({
      ...customer.toObject(),
      totalBills
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Add customer ────────────────────────────────────────────────────────────
const addCustomer = async (req, res) => {
  try {
    const { name, addressLine1, addressLine2, phone, creditLimit } = req.body;

    if (!name || !name.trim())   return res.status(400).json({ message: 'Customer name is required' });
    if (!phone || !phone.trim()) return res.status(400).json({ message: 'Phone number is required' });

    const existing = await Customer.findOne({ phone: phone.trim() });
    if (existing) {
      return res.status(400).json({ message: `Phone number already registered to ${existing.name} (${existing.customerId})` });
    }

    const limit = parseFloat(creditLimit);
    if (isNaN(limit) || limit < 0) {
      return res.status(400).json({ message: 'Credit limit must be a valid amount' });
    }

    const customerId = await getNextCustomerId();

    const customer = new Customer({
      customerId,
      name: name.trim(),
      addressLine1: (addressLine1 || '').trim(),
      addressLine2: (addressLine2 || '').trim(),
      phone: phone.trim(),
      creditLimit: limit,
      pendingBalance: 0
    });

    const saved = await customer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ─── Update customer ─────────────────────────────────────────────────────────
const updateCustomer = async (req, res) => {
  try {
    const { name, addressLine1, addressLine2, phone, creditLimit } = req.body;

    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    if (phone && phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({
        phone: phone.trim(),
        customerId: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ message: `Phone number already registered to ${existing.name} (${existing.customerId})` });
      }
      customer.phone = phone.trim();
    }

    if (creditLimit !== undefined) {
      const limit = parseFloat(creditLimit);
      if (isNaN(limit) || limit < 0) {
        return res.status(400).json({ message: 'Credit limit must be a valid amount' });
      }
      // Can't set a limit below what they already owe
      if (limit < customer.pendingBalance) {
        return res.status(400).json({
          message: `Credit limit cannot be less than the current pending balance (Rs. ${customer.pendingBalance.toFixed(2)})`
        });
      }
      customer.creditLimit = limit;
    }

    if (name) customer.name = name.trim();
    if (addressLine1 !== undefined) customer.addressLine1 = addressLine1.trim();
    if (addressLine2 !== undefined) customer.addressLine2 = addressLine2.trim();

    const updated = await customer.save();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ─── Delete customer (blocked while money is owed) ───────────────────────────
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    await recalcCustomerBalance(customer.customerId);
    const fresh = await Customer.findOne({ customerId: req.params.id });

    if (fresh.pendingBalance > 0) {
      return res.status(400).json({
        message: `Cannot remove ${fresh.name}. Pending balance of Rs. ${fresh.pendingBalance.toFixed(2)} must be settled first.`
      });
    }

    await Customer.deleteOne({ customerId: req.params.id });
    res.json({ message: 'Customer removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Bill history of a customer ──────────────────────────────────────────────
const getCustomerBills = async (req, res) => {
  try {
    const bills = await Bill.find({ customerId: req.params.id }).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Payment history of a customer ───────────────────────────────────────────
const getCustomerPayments = async (req, res) => {
  try {
    const payments = await CustomerPayment.find({ customerId: req.params.id })
      .sort({ paymentDate: -1, createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Record a payment (FIFO: settles oldest pending bills first) ─────────────
const recordPayment = async (req, res) => {
  try {
    const { amount, note, paymentDate } = req.body;
    const customerId = req.params.id;

    const customer = await Customer.findOne({ customerId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Please enter a valid payment amount' });
    }

    // Always work from a fresh balance
    const pending = await recalcCustomerBalance(customerId);

    if (pending <= 0) {
      return res.status(400).json({ message: 'This customer has no pending balance' });
    }
    if (amt > pending + 0.001) {
      return res.status(400).json({
        message: `Payment (Rs. ${amt.toFixed(2)}) is more than the pending balance (Rs. ${pending.toFixed(2)})`
      });
    }

    // Allocate the payment to the oldest pending bills first
    let remaining = amt;
    const pendingBills = await Bill.find({ customerId, paymentStatus: 'pending' })
      .sort({ createdAt: 1 });

    for (const bill of pendingBills) {
      if (remaining <= 0.001) break;

      const due = bill.totalAmount - (bill.paidAmount || 0);
      const pay = Math.min(due, remaining);

      bill.paidAmount = parseFloat(((bill.paidAmount || 0) + pay).toFixed(2));
      if (bill.paidAmount >= bill.totalAmount - 0.001) {
        bill.paymentStatus = 'paid';
      }
      await bill.save();

      remaining = parseFloat((remaining - pay).toFixed(2));
    }

    // Store the payment record
    const when = paymentDate
      ? moment.tz(paymentDate, 'YYYY-MM-DD', TZ)
      : moment().tz(TZ);

    const payment = await CustomerPayment.create({
      customerId,
      amount: amt,
      note: (note || '').trim(),
      paymentDate: when.toDate(),
      dayIdentifier: when.format('YYYY-MM-DD'),
      recordedBy: (req.user && req.user.username) ? req.user.username : 'user'
    });

    const newBalance = await recalcCustomerBalance(customerId);

    res.status(201).json({ payment, pendingBalance: newBalance });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getAllCustomers,
  searchCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBills,
  getCustomerPayments,
  recordPayment,
  recalcCustomerBalance   // used by billController
};