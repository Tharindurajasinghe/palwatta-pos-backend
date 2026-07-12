const Order = require('../models/Order');
const Product = require('../models/Product');
const Bill = require('../models/Bill');
const ActiveDay = require('../models/ActiveDay');
const moment = require('moment-timezone');

const TZ = 'Asia/Colombo';

// ─── Next order ID (ORD001, ORD002 ...) ──────────────────────────────────────
const getNextOrderId = async () => {
  const last = await Order.findOne().sort({ orderId: -1 });
  if (!last) return 'ORD001';
  const n = parseInt(last.orderId.replace('ORD', ''), 10);
  return `ORD${String(n + 1).padStart(3, '0')}`;
};

// ─── Next bill ID (same rule as billController) ──────────────────────────────
const generateBillIdForOrder = async () => {
  const lastBill = await Bill.findOne().sort({ billId: -1 });
  if (!lastBill) return '10001';
  return (parseInt(lastBill.billId) + 1).toString();
};

// ─── Auto-cleanup: delete completed orders older than 1 day ──────────────────
// Exported — used by cron in server.js and called on every order fetch.
const deleteOldCompletedOrders = async () => {
  const cutoff = moment().tz(TZ).subtract(1, 'day').toDate();
  const result = await Order.deleteMany({
    status: 'completed',
    completedAt: { $ne: null, $lte: cutoff }
  });
  if (result.deletedCount > 0) {
    console.log(`Auto-removed ${result.deletedCount} completed order(s) older than 1 day`);
  }
  return result.deletedCount;
};

// ─── Get all orders (pending first, then by delivery date) ───────────────────
const getAllOrders = async (req, res) => {
  try {
    await deleteOldCompletedOrders();   // housekeeping on every load
    const orders = await Order.find().sort({ status: 1, deliveryDate: 1, deliveryTime: 1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Get only pending orders (used by the alert box on the billing screen) ───
const getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'pending' })
      .sort({ deliveryDate: 1, deliveryTime: 1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Create an order — NO bill, NO stock change ──────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { customerName, phone, deliveryDate, deliveryTime, message, items } = req.body;

    if (!customerName || !customerName.trim()) return res.status(400).json({ message: 'Customer name is required' });
    if (!phone || !phone.trim())               return res.status(400).json({ message: 'Telephone number is required' });
    if (!deliveryDate)                         return res.status(400).json({ message: 'Delivery date is required' });
    if (!items || items.length === 0)          return res.status(400).json({ message: 'Order has no items' });

    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(400).json({ message: `Product ${item.productId} not found` });
      }

      const price = (item.customPrice !== undefined && item.customPrice !== null)
        ? parseFloat(item.customPrice)
        : product.sellingPrice;

      if (price < product.buyingPrice) {
        return res.status(400).json({
          message: `Price for "${product.name}" (Rs. ${price}) cannot be less than buying price (Rs. ${product.buyingPrice})`
        });
      }

      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        price,
        originalSellingPrice: product.sellingPrice,
        total: itemTotal
      });
      // NOTE: stock is intentionally NOT touched here.
    }

    const orderId = await getNextOrderId();

    const order = new Order({
      orderId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      deliveryDate,
      deliveryTime: deliveryTime || '',
      message: (message || '').trim(),
      items: orderItems,
      totalAmount,
      status: 'pending'
    });

    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ─── Complete an order → NOW create the bill and reduce stock ────────────────
const completeOrder = async (req, res) => {
  try {
    const { cash } = req.body;

    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'completed') {
      return res.status(400).json({ message: 'This order is already completed' });
    }

    // 1) Check stock for every item FIRST (so we never half-deduct)
    for (const item of order.items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(400).json({ message: `Product ${item.productId} (${item.name}) no longer exists` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Needed: ${item.quantity}, Available: ${product.stock}`
        });
      }
    }

    // 2) Build the bill items and reduce stock
    const billItems = [];
    let totalAmount = 0;

    for (const item of order.items) {
      const product = await Product.findOne({ productId: item.productId });

      const itemTotal = item.price * item.quantity;
      totalAmount += itemTotal;

      billItems.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        price: item.price,
        buyingPrice: product.buyingPrice,               // current buying price → correct profit
        originalSellingPrice: product.sellingPrice,
        total: itemTotal
      });

      product.stock -= item.quantity;
      await product.save();
    }

    // 3) Cash / change (defaults to exact payment if not sent)
    const cashPaid = (cash === undefined || cash === null || cash === '')
      ? totalAmount
      : parseFloat(cash);

    if (isNaN(cashPaid) || cashPaid < totalAmount) {
      // restore stock, since we already deducted above
      for (const bi of billItems) {
        const p = await Product.findOne({ productId: bi.productId });
        if (p) { p.stock += bi.quantity; await p.save(); }
      }
      return res.status(400).json({ message: 'Insufficient cash' });
    }

    const change = cashPaid - totalAmount;

    // 4) Create the bill — a completely normal bill
    const now = moment().tz(TZ);
    const billId = await generateBillIdForOrder();
    const dayIdentifier = now.format('YYYY-MM-DD');

    const bill = new Bill({
      billId,
      items: billItems,
      totalAmount,
      date: now.toDate(),
      time: now.format('hh:mm A'),
      cash: cashPaid,
      change,
      dayIdentifier
    });
    await bill.save();

    // 5) Update ActiveDay exactly like a normal bill
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

    // 6) Mark the order completed
    order.status = 'completed';
    order.completedAt = now.toDate();
    order.billId = billId;
    await order.save();

    res.json({ order, bill });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ─── Delete an order (manual remove) ────────────────────────────────────────
// Nothing to restore: a pending order never touched stock, and a completed
// order's bill stays in the system on purpose.
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await Order.deleteOne({ orderId: req.params.id });
    res.json({ message: 'Order removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllOrders,
  getPendingOrders,
  createOrder,
  completeOrder,
  deleteOrder,
  deleteOldCompletedOrders   // used by cron in server.js
};