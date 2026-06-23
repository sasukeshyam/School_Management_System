const express = require('express');
const router = express.Router();
const { login, masterLogin, refresh, logout, changePassword, me } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');

router.post('/master-login',    masterLogin); 
router.post('/login',           login);
router.post('/refresh',         refresh);
router.post('/logout',          authenticate, logout);
router.put('/change-password',  authenticate, changePassword);
router.get('/me',               authenticate, me);

module.exports = router;
