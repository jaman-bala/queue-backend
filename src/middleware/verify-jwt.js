const jwt = require('jsonwebtoken');

const verifyJWT = (req, res, next) => {
    try {
        const authHeader =
            req.headers.authorization || req.headers.Authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];

        if (!process.env.ACCESS_TOKEN_SECRET) {
            throw new Error(
                'Environment variables ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be defined',
            );
        }

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            req.user = decoded;
        } catch (error) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        next();
    } catch (error) {
        res.status(403).json({ message: 'Нет доступа' });
    }
};

export default verifyJWT;
