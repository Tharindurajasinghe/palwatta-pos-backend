const Product = require('../models/Product');

// Get next available product ID
const getNextProductId = async (req, res) => {
  try {
    const products = await Product.find().sort({ productId: 1 });
    const usedIds = new Set(products.map(p => parseInt(p.productId)));
    
    for (let i = 1; i <= 999; i++) {
      if (!usedIds.has(i)) {
        return res.json({ productId: i.toString().padStart(3, '0') });
      }
    }
    
    res.status(400).json({ message: 'No available product IDs' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ productId: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Search products by name (case-insensitive)
const searchProducts = async (req, res) => {
  try {
    const { query } = req.query;
    const products = await Product.find({
      name: { $regex: query, $options: 'i' }
    }).limit(10);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new product
const addProduct = async (req, res) => {
  try {
    const { productId, name, stock, buyingPrice, sellingPrice } = req.body;
    
    // Check if product ID already exists
    const existing = await Product.findOne({ productId });
    if (existing) {
      return res.status(400).json({ message: 'Product ID already exists' });
    }
    
    // Validate product ID format
    if (!/^[0-9]{3}$/.test(productId) || parseInt(productId) < 1 || parseInt(productId) > 999) {
      return res.status(400).json({ message: 'Invalid product ID. Must be between 001-999' });
    }
    
    const product = new Product({
      productId,
      name,
      stock,
      buyingPrice,
      sellingPrice
    });
    
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { name, stock, buyingPrice, sellingPrice } = req.body;
    
    const product = await Product.findOne({ productId: req.params.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (name) product.name = name;
    if (stock !== undefined) product.stock = stock;
    if (buyingPrice !== undefined) product.buyingPrice = buyingPrice;
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice;
    
    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await Product.deleteOne({ productId: req.params.id });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getNextProductId,
  getAllProducts,
  searchProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct
};
