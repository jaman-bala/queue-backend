const {
    getAllWaitingDepartmentsQueue,
    getCurrentQueue,
} = require('../controllers/queue-controllers.js');
const { Router } = require('express');

const router = Router();

router.get('/:departmentId', getAllWaitingDepartmentsQueue);
router.get('/specialist/:sessionId', getCurrentQueue);

module.exports = router;
