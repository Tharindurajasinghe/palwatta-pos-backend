const Category = require('../models/Category');
const Product = require('../models/Product');

// Generate next category ID
const getNextCategoryId = async () => {
  const lastCategory = await Category.findOne().sort({ categoryId: -1 });
  if (!lastCategory) return 'CAT001';
  
  const lastNum = parseInt(lastCategory.categoryId.replace('CAT', ''));
  const nextNum = lastNum + 1;
  return `CAT${nextNum.toString().padStart(3, '0')}`;
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({ categoryId: req.params.id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new category
const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if category name already exists
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    
    const categoryId = await getNextCategoryId();
    
    const category = new Category({
      categoryId,
      name: name.trim(),
      description: description || ''
    });
    
    const newCategory = await category.save();
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const category = await Category.findOne({ categoryId: req.params.id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if new name already exists (excluding current category)
    if (name) {
      const existing = await Category.findOne({ 
        name: name.trim(), 
        categoryId: { $ne: req.params.id } 
      });
      if (existing) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      category.name = name.trim();
    }
    
    if (description !== undefined) category.description = description;
    
    const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ categoryId: req.params.id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if any products are using this category
    const productsCount = await Product.countDocuments({ categoryId: req.params.id });
    if (productsCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. ${productsCount} product(s) are using this category.` 
      });
    }
    
    await Category.deleteOne({ categoryId: req.params.id });
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ categoryId: req.params.id }).sort({ productId: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory
};