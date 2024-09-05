const cors = require('cors');

const host = process.env.HOST || 'http://localhost:5173/';

const allowedOrigins = [host];

const options = {
    origin: allowedOrigins,
};

module.exports = options;
