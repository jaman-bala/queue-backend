const Department = require('../models/department-model.js');

const getAllDepartments = async (req, res) => {
    try {
        const foundDepartments = await Department.find().exec();
        if (!foundDepartments) {
            res.status(500).json('Something went wrong with Departments');
        }
        await res.status(200).json(foundDepartments);
    } catch (error) {
        await res.status(500).json('Server error on get departments');
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
        await res.status(500).json('Server error on get departments');
    }
};

module.exports = { getAllDepartments, addNewDepartment };
