const { Router } = require('express');
const {
    login,
    logout,
    createNewUser,
} = require('../controllers/auth-controllers.js');
const loginLimiter = require('../middleware/login-limitter.js');

const router = Router();

router.post('/', loginLimiter, login);

router.post('/register', createNewUser);

router.post('/logout', logout);

module.exports = router;
