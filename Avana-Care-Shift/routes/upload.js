const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const uc = require('../controllers/uploadController');

router.post('/profile', authenticate, uc.uploadAndProcessProfilePic);
router.post('/logo', authenticate, requireRole('admin'), uc.uploadCompanyLogo);

module.exports = router;
