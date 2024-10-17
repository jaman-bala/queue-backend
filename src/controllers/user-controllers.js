const Department = require('../models/department-model');
const User = require('../models/user-model');
const bcrypt = require('bcrypt');

const getCurrentDepartmentUsers = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const foundDepartment = await Department.findById(departmentId);
        if (!foundDepartment) {
            return res.status(404).json({ message: 'Нет такого филиала' });
        }
        const allDepartmentUsers = await User.find({
            departmentId: foundDepartment._id,
            role: { $ne: 'admin' },
        });
        if (!allDepartmentUsers) {
            return res.status(200).json({ message: 'Пользователей нет' });
        }
        res.status(200).json(allDepartmentUsers);
    } catch (error) {
        res.status(500).json({
            message: 'Ошибка при поиске пользователей',
            errorMessage: error.message,
        });
    }
};

const editUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, name, role, departmentId } = req.body;

        if (!username || !name || !role || !departmentId) {
            return res.status(404).json({ message: 'Заполните все поля' });
        }

        const foundUser = await User.findById(userId);
        if (!foundUser) {
            res.status(404).json({ message: 'Такого пользователя нет в базе' });
        }

        foundUser.username = username;
        foundUser.name = name;
        foundUser.role = role;
        foundUser.departmentId = departmentId;

        await foundUser.save();

        res.status(200).json({
            message: 'Пользователь успешно обновлён',
            newUserData: foundUser,
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Такого пользователя нет' });
        }

        await User.findByIdAndDelete(userId);

        return res
            .status(200)
            .json({ message: 'Пользователь успешно удалён', userId: user._id });
    } catch (error) {
        console.error('Ошибка сервера:', error);
        return res
            .status(500)
            .json({ message: 'Ошибка сервера при удалении пользователя' });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const foundUser = await User.findById(userId);
        if (!foundUser) {
            return res.status(404).json({ message: 'Такого пользователя нет' });
        }
        res.status(200).json({ userData: foundUser });
    } catch (error) {
        res.status(500).json({
            message: 'Ошибка сервера при получении данных о пользователе',
            errorMessage: error,
        });
    }
};

const editUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { password } = req.body;
        const foundUser = await User.findById(userId);
        if (!foundUser) {
            return res.status(404).json({ message: 'Такого пользователя нет' });
        }
        const match = await bcrypt.compare(password, foundUser.password);

        if (match) {
            return res
                .status(401)
                .json({ message: 'Пароль должен быть не похож на старый' });
        }
        const newPassword = await bcrypt.hash(password, 10);
        foundUser.password = newPassword;
        await foundUser.save();
        res.status(200).json({
            message: 'Пароль пользователя успешно изменён',
        });
    } catch (error) {
        res.status(500).json({
            message: 'Ошибка сервера при изменении пароля',
            errorMessage: error,
        });
    }
};

module.exports = {
    getCurrentDepartmentUsers,
    editUser,
    deleteUser,
    getCurrentUser,
    editUserPassword,
};
