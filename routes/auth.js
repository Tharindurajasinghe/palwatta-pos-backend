const express = require('express');
const router = express.Router();
const { login, verifyPassword, verifyPagePassword } = require('../controllers/authController');


router.post('/login', login);
router.post('/verify-password',verifyPassword);
router.post('/verify-page-password', verifyPagePassword);
 

module.exports = router;

