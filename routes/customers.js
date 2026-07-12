const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getAllCustomers,
  searchCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBills,
  getCustomerPayments,
  recordPayment
} = require('../controllers/customerController');

router.use(authenticateToken);

// NOTE: '/search' must come before '/:id'
router.get('/search', searchCustomers);

router.get('/', getAllCustomers);
router.post('/', addCustomer);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

router.get('/:id/bills', getCustomerBills);
router.get('/:id/payments', getCustomerPayments);
router.post('/:id/payments', recordPayment);

module.exports = router;