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

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/day', require('./routes/day'));

// Auto end day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running auto day-end at midnight');
  const ActiveDay = require('./models/ActiveDay');
  const Bill = require('./models/Bill');
  const Product = require('./models/Product');
  const DailySummary = require('./models/DailySummary');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const activeDay = await ActiveDay.findOne({ date: yesterdayStr, isActive: true });
  
  if (activeDay) {
    // Calculate day summary
    const bills = await Bill.find({ dayIdentifier: yesterdayStr });
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
      date: yesterdayStr,
      items: Array.from(itemsMap.values()),
      totalIncome,
      totalProfit,
      endedAt: new Date()
    });

    activeDay.isActive = false;
    await activeDay.save();
    
    console.log(`Auto day-end completed for ${yesterdayStr}`);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));