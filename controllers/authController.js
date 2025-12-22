const login = (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.LOGIN_USERNAME && password === process.env.LOGIN_PASSWORD) {
    return res.json({ success: true, message: 'Login successful' });
  }
  
  res.status(401).json({ success: false, message: 'Invalid credentials' });
};

module.exports = { login };