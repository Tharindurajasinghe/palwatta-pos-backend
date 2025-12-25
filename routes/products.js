const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

const {
  getNextProductId,
  getAllProducts,
  searchProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

router.use(authenticateToken);

// Get next available product ID
router.get('/next-id', getNextProductId);

// Get all products
router.get('/', getAllProducts);

// Search products by name (case-insensitive)
router.get('/search', searchProducts);

// Get product by ID
router.get('/:id', getProductById);

// Add new product
router.post('/', addProduct);

// Update product
router.put('/:id', updateProduct);

// Delete product
router.delete('/:id', deleteProduct);

module.exports = router;