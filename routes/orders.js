const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getAllOrders,
  getPendingOrders,
  createOrder,
  completeOrder,
  deleteOrder
} = require('../controllers/orderController');

router.use(authenticateToken);

// '/pending' must come before '/:id'
router.get('/pending', getPendingOrders);

router.get('/', getAllOrders);
router.post('/', createOrder);
router.post('/:id/complete', completeOrder);
router.delete('/:id', deleteOrder);

module.exports = router;