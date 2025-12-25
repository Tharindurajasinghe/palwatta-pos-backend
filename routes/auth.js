const express = require('express');
const router = express.Router();
const { login, verifyPassword } = require('../controllers/authController');


router.post('/login', login);
router.post('/verify-password',verifyPassword);
 

module.exports = router;

