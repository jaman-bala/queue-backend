const verifyAdmin = (req, res, next) => {
    try {
        const { user } = req;
        if (!user) {
            return res.status(403).json({ message: 'Доступа нет' });
        }

        if (user.UserInfo.role !== 'admin') {
            return res.status(403).json({ message: 'Доступа нет' });
        } else {
            next();
        }
    } catch (error) {
        res.status(403).json({ message: 'Нет доступа' });
    }
};

export default verifyAdmin;
