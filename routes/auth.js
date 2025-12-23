const express = require('express');
const router = express.Router();
const { login, variPass } = require('../controllers/authController');

router.post('/login', login);
router.post('/verify-password',variPass)
 

module.exports = router;

