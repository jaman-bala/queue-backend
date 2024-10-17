const User = require('../models/user-model.js');
const Session = require('../models/session-model.js');
const Department = require('../models/department-model.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Queue = require('../models/queue-model.js');

const login = async (req, res) => {
    try {
        const { username, password, ticketsType, windowNumber } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Заполните все поля' });
        }

        const foundUser = await User.findOne({ username }).exec();

        if (!foundUser) {
            return res.status(401).json({ message: 'Пользователь не найден' });
        }
        console.log('windowNumber : ' + (!ticketsType && !windowNumber));

        if (
            foundUser.role === 'specialist' &&
            (!ticketsType || !windowNumber)
        ) {
            return res.status(400).json({ message: 'Заполните все поля' });
        }

        if (!foundUser.active) {
            return res
                .status(401)
                .json({ message: 'Пользователь заблокирован' });
        }

        const match = await bcrypt.compare(password, foundUser.password);

        if (!match) {
            return res.status(401).json({ message: 'Неверный пароль' });
        }

        if (
            !process.env.ACCESS_TOKEN_SECRET ||
            !process.env.REFRESH_TOKEN_SECRET
        ) {
            return res.status(500).json({
                message:
                    'Не установлены переменные окружения ACCESS_TOKEN_SECRET и REFRESH_TOKEN_SECRET',
            });
        }

        const sessionData = {
            userInfo: foundUser._id,
            department: foundUser.departmentId,
        };

        if (foundUser.role === 'specialist') {
            sessionData.windowNumber = windowNumber;
            sessionData.ticketsType = ticketsType;
        }

        const newSession = new Session(sessionData);
        const savedSession = await newSession.save();

        if (!savedSession) {
            return res
                .status(500)
                .json({ message: 'Ошибка при создании сессии' });
        }

        const department = await Department.findById(foundUser.departmentId);

        if (!department) {
            return res
                .status(400)
                .json({ message: 'Филиал пользователя не найден' });
        }

        department.sessions.push(savedSession._id);
        const savedDepartment = await department.save();

        const accessToken = jwt.sign(
            {
                UserInfo: {
                    user: foundUser._id,
                    username: foundUser.username,
                    role: foundUser.role,
                    ticketsType,
                    name: foundUser.name,
                },
                DepartmentInfo: {
                    departmentId: savedDepartment._id,
                    name: savedDepartment.name,
                },
                SessionInfo: {
                    sessionId: savedSession._id,
                    windowNumber: savedSession.windowNumber,
                },
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '2d' },
        );

        console.log({ accessToken, path: foundUser.role });

        return res.json({ accessToken, path: foundUser.role });
    } catch (error) {
        console.error('Ошибка во время входа пользователя:', error);
        return res.status(500).json({
            message: 'Ошибка на сервере при входе в систему',
            error: error.message,
        });
    }
};

const createNewUser = async (req, res) => {
    try {
        const { username, password, role, departmentId, name } = req.body;

        if (!username || !password || !role || !departmentId || !name) {
            return res
                .status(400)
                .json({ message: 'Нужно заполнить все поля' });
        }

        const duplicate = await User.findOne({ username }).lean().exec();

        if (duplicate) {
            return res
                .status(409)
                .json({ message: 'Такой пользователь уже есть' });
        }

        const hashedPwd = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPwd,
            role,
            departmentId,
            name,
        });

        const savedUser = await newUser.save();

        if (savedUser) {
            res.status(201).json({
                message: `New user ${username} created`,
                data: savedUser,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data received' });
        }
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong on registration',
        });
    }
};

const createAdmin = async (req, res) => {
    const hashedPwd = await bcrypt.hash('admin123128', 10);

    const newUser = new User({
        username: 'sabyr128',
        password: hashedPwd,
        role: 'admin',
        departmentId: '66d1b2a588b22ee12cc50aab',
        name: 'Sabyr',
    });

    const savedUser = await newUser.save();
    console.log(savedUser.username);
};

const logout = async (req, res) => {
    const { sessionId, userId } = req.body;
    try {
        const foundSession = await Session.findById(sessionId);
        if (!foundSession) {
            return res
                .status(400)
                .json({ message: 'Не получилось найти сессию' });
        }
        foundSession.endTime = new Date();
        foundSession.isAvailable = false;

        const foundUser = await User.findById(userId);

        if (!foundUser) {
            res.status(400).json({ message: 'Нет такого пользователя' });
        }

        if (foundUser.role === 'specialist') {
            const foundQueue = await Queue.findById(foundSession.currentQueue);
            if (foundQueue) {
                foundQueue.status = 'completed';
                await foundQueue.save();
            }
            foundSession.currentQueue = null;
            foundSession.status = 'available';
        }
        await foundSession.save();

        res.status(200).json({
            message: 'Пользователь успешно окончил сессию',
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Что-то пошло не так' });
    }
};

module.exports = { login, createNewUser, logout, createAdmin };
