const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getAllCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory
} = require('../controllers/categoryController');

// All routes need authentication
router.use(authenticateToken);

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.post('/', addCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);
router.get('/:id/products', getProductsByCategory);

module.exports = router;