const jwt = require('jsonwebtoken');

const login = (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.LOGIN_USERNAME && password === process.env.LOGIN_PASSWORD) {
    // Generate JWT token
    const token = jwt.sign(
      { username: username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    return res.json({ 
      success: true, 
      message: 'Login successful',
      token: token
    });
  }
  
  res.status(401).json({ success: false, message: 'Invalid credentials' });
};

const verifyPassword = (req, res) => {
  const { password } = req.body;
  
  if (password === process.env.LOGIN_PASSWORD) {
    return res.json({ success: true });
  }
  
  res.status(401).json({ success: false });
};

module.exports = { login, verifyPassword};