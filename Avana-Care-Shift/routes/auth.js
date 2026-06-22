const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.registerClient);
router.get('/me', authenticate, authController.getMe);
router.put('/password', authenticate, authController.changePassword);

module.exports = router;
