const DailySummary = require('../models/DailySummary');
const MonthlySummary = require('../models/MonthlySummary');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const moment = require('moment-timezone');

const TZ = 'Asia/Colombo';

// ─── Helper: build a monthly summary for a given YYYY-MM ───────────────────
async function buildMonthlySummary(yearMonth) {
  const start = moment.tz(yearMonth, 'YYYY-MM', TZ).startOf('month');
  const end   = moment.tz(yearMonth, 'YYYY-MM', TZ).endOf('month');

  const bills = await Bill.find({
    dayIdentifier: {
      $gte: start.format('YYYY-MM-DD'),
      $lte: end.format('YYYY-MM-DD')
    }
  });

  if (bills.length === 0) return null;

  const itemsMap = new Map();
  let totalIncome = 0;
  let totalProfit = 0;

  for (const bill of bills) {
    for (const item of bill.items) {
      // Use stored buyingPrice if available, otherwise fall back to live product
      let buyingPrice = item.buyingPrice;
      if (buyingPrice === undefined || buyingPrice === null) {
        const product = await Product.findOne({ productId: item.productId });
        buyingPrice = product ? product.buyingPrice : 0;
      }

      const profit = (item.price - buyingPrice) * item.quantity;

      if (itemsMap.has(item.productId)) {
        const ex = itemsMap.get(item.productId);
        ex.soldQuantity += item.quantity;
        ex.totalIncome  += item.total;
        ex.profit       += profit;
      } else {
        itemsMap.set(item.productId, {
          productId:    item.productId,
          name:         item.name,
          soldQuantity: item.quantity,
          totalIncome:  item.total,
          profit
        });
      }

      totalIncome += item.total;
      totalProfit += profit;
    }
  }

  return {
    month:       start.format('YYYY-MM'),
    monthName:   start.format('MMMM YYYY'),
    items:       Array.from(itemsMap.values()),
    totalIncome,
    totalProfit,
    startDate:   start.format('YYYY-MM-DD'),
    endDate:     end.format('YYYY-MM-DD'),
    daysIncluded: end.diff(start, 'days') + 1
  };
}

// ─── Save (create or update) a monthly summary ─────────────────────────────
async function saveMonthlySummary(data) {
  let record = await MonthlySummary.findOne({ month: data.month });
  if (record) {
    Object.assign(record, data);
  } else {
    record = new MonthlySummary(data);
  }
  await record.save();

  // Keep only last 12 months
  const all = await MonthlySummary.find().sort({ month: -1 });
  if (all.length > 12) {
    for (const old of all.slice(12)) {
      await MonthlySummary.deleteOne({ _id: old._id });
    }
  }

  return record;
}

// ─── Backfill: calculate summaries for all past months that have bills ──────
async function backfillPastMonths() {
  // Find the earliest bill in the DB
  const earliest = await Bill.findOne().sort({ dayIdentifier: 1 });
  if (!earliest) return;

  const startMonth = moment.tz(earliest.dayIdentifier, 'YYYY-MM-DD', TZ).startOf('month');
  const thisMonth  = moment.tz(TZ).startOf('month');

  let cursor = startMonth.clone();

  while (cursor.isBefore(thisMonth)) {
    const ym = cursor.format('YYYY-MM');
    const existing = await MonthlySummary.findOne({ month: ym });

    if (!existing) {
      console.log(`Backfilling monthly summary for ${ym}...`);
      const data = await buildMonthlySummary(ym);
      if (data) {
        await saveMonthlySummary(data);
        console.log(`  ✓ Saved summary for ${ym}`);
      } else {
        console.log(`  – No bills found for ${ym}, skipping`);
      }
    }

    cursor.add(1, 'month');
  }
}

// ─── Auto month-end: called by cron on last day of each month at 23:59 ──────
async function autoCreateMonthSummary() {
  const now = moment.tz(TZ);
  const ym  = now.format('YYYY-MM');
  console.log(`Auto month-end: creating summary for ${ym}`);
  const data = await buildMonthlySummary(ym);
  if (data) {
    await saveMonthlySummary(data);
    console.log(`  ✓ Monthly summary saved for ${ym}`);
  } else {
    console.log(`  – No bills for ${ym}`);
  }
}

// ─── HTTP handlers ───────────────────────────────────────────────────────────

const getDailySummary = async (req, res) => {
  try {
    const summary = await DailySummary.findOne({ date: req.params.date });
    if (!summary) return res.status(404).json({ message: 'No summary found for this date' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Manual trigger — generates/regenerates summary for a specific YYYY-MM
const createMonthlySummary = async (req, res) => {
  try {
    // Accept ?month=YYYY-MM or default to current month
    const ym = req.query.month || moment.tz(TZ).format('YYYY-MM');
    const data = await buildMonthlySummary(ym);
    if (!data) return res.status(400).json({ message: `No bills found for ${ym}` });
    const saved = await saveMonthlySummary(data);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getMonthlySummary = async (req, res) => {
  try {
    const summary = await MonthlySummary.findOne({ month: req.params.month });
    if (!summary) return res.status(404).json({ message: 'No summary found for this month' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllMonthlySummaries = async (req, res) => {
  try {
    const summaries = await MonthlySummary.find().sort({ month: -1 }).limit(12);
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAvailableDates = async (req, res) => {
  try {
    const today = moment().tz(TZ);
    const dates = [{ date: today.format('YYYY-MM-DD'), label: 'Today' }];
    for (let i = 1; i <= 29; i++) {
      const d = moment(today).subtract(i, 'days');
      dates.push({ date: d.format('YYYY-MM-DD'), label: d.format('MMM D, YYYY') });
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
  getAvailableDates,
  autoCreateMonthSummary,   // used by cron in server.js
  backfillPastMonths        // used on startup in server.js
};