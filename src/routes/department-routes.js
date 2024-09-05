const {
    getAllDepartments,
    addNewDepartment,
} = require('../controllers/department-controllers.js');
const { Router } = require('express');

const router = Router();

router.get('/', getAllDepartments);
router.post('/add', addNewDepartment);

module.exports = router;
