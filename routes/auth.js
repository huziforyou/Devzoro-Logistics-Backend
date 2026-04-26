const express = require('express');
const { register, login, getMe, logout } = require('../controllers/auth');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', protect, authorize('admin', 'super-admin'), register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/profile', protect, getMe);

module.exports = router;
