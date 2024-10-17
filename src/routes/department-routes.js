const {
    getAllDepartments,
    addNewDepartment,
    deleteDepartment,
    editDepartment,
    getCurrentDepartment,
} = require('../controllers/department-controllers.js');
const { Router } = require('express');

const router = Router();

router.get('/', getAllDepartments);
router.post('/add', addNewDepartment);
router.delete('/:departmentId', deleteDepartment);
router.put('/:departmentId', editDepartment);
router.get('/:departmentId', getCurrentDepartment);

module.exports = router;
