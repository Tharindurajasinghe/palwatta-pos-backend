const login = (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.LOGIN_USERNAME && password === process.env.LOGIN_PASSWORD) {
    return res.json({ success: true, message: 'Login successful' });
  }
  
  res.status(401).json({ success: false, message: 'Invalid credentials' });
};

const variPass =  (req,res) => {
  const { password } = req.body;
  
  if (password === process.env.LOGIN_PASSWORD) {
    return res.json({ success: true });
  }
  
  res.status(401).json({ success: false });
}

module.exports = { login , variPass };