const Department = require('../models/department-model.js');

const getAllDepartments = async (req, res) => {
    try {
        const foundDepartments = await Department.find().exec();
        if (!foundDepartments) {
            res.status(500).json('Something went wrong with Departments');
        }
        await res.status(200).json(foundDepartments);
    } catch (error) {
        res.status(500).json('Server error on get departments');
    }
};

const addNewDepartment = async (req, res) => {
    const { name } = req.body;
    try {
        const duplicate = await Department.findOne({ name: name }).exec();
        if (duplicate) {
            res.status(500).json('Already have one');
        }
        const newDepartment = await Department.create({ name: name });

        await res.status(200).json(newDepartment);
    } catch (error) {
        res.status(500).json('Server error on get departments');
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const foundDepartment = await Department.findById(departmentId);
        if (!foundDepartment) {
            return res.status(404).json({ message: 'Такой филиал не найден' });
        }
        await Department.findByIdAndDelete(foundDepartment._id);
        res.status(200).json({
            deletedDepartment: foundDepartment,
            message: 'Филиал успешно удалён',
        });
    } catch (error) {
        res.status(500).json('Ошибка сервера при удалении филиала');
    }
};

const editDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { name } = req.body;
        const foundDepartment = await Department.findById(departmentId);
        if (!foundDepartment) {
            return res.status(404).json({ message: 'Такой филиал не найден' });
        }
        foundDepartment.name = name;
        await foundDepartment.save();
        console.log(foundDepartment);
        res.status(200).json({
            editedDepartment: foundDepartment,
            message: 'Филиал успешно изменён',
        });
    } catch (error) {
        res.status(500).json('Ошибка сервера при изменении филиала');
    }
};

const getCurrentDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const foundDepartment = await Department.findById(departmentId);
        if (!foundDepartment) {
            return res.status(404).json({ message: 'Такого филиала нет' });
        }
        res.status(200).json({ department: foundDepartment });
    } catch (error) {
        res.status(500).json('Ошибка сервера при поиски филиала');
    }
};

module.exports = {
    getAllDepartments,
    addNewDepartment,
    deleteDepartment,
    editDepartment,
    getCurrentDepartment,
};
