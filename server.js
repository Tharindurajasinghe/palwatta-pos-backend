const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cron = require('node-cron');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/day', require('./routes/day'));
app.use('/api/categories', require('./routes/categories'));

// Connect to MongoDB, then backfill any missing past month summaries
const { autoCreateMonthSummary, backfillPastMonths } = require('./controllers/summaryController');

connectDB().then(async () => {
  await backfillPastMonths();
});

// Auto day-end at midnight Sri Lanka time
cron.schedule('0 0 * * *', async () => {
  console.log('Running auto day-end at midnight Sri Lanka time');
  const moment = require('moment-timezone');
  const ActiveDay = require('./models/ActiveDay');
  const Bill = require('./models/Bill');
  const Product = require('./models/Product');
  const DailySummary = require('./models/DailySummary');

  const endedDay = moment().tz('Asia/Colombo').subtract(1, 'minute');
  const endedDayStr = endedDay.format('YYYY-MM-DD');

  console.log(`Checking for active day: ${endedDayStr}`);

  const activeDay = await ActiveDay.findOne({ date: endedDayStr, isActive: true });

  if (activeDay) {
    console.log(`Active day found for ${endedDayStr}, creating summary...`);
    const bills = await Bill.find({ dayIdentifier: endedDayStr });
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

    await DailySummary.create({
      date: endedDayStr,
      items: Array.from(itemsMap.values()),
      totalIncome,
      totalProfit,
      endedAt: new Date()
    });

    activeDay.isActive = false;
    await activeDay.save();

    console.log(`Auto day-end completed for ${endedDayStr}`);
  }

}, { timezone: 'Asia/Colombo' });

// Auto month-end: 00:02 on the 1st of each month (after day-end cron has run)
cron.schedule('2 0 1 * *', autoCreateMonthSummary, { timezone: 'Asia/Colombo' });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));