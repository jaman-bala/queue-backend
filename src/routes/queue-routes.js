const {
    getAllWaitingDepartmentsQueue,
    getCurrentQueue,
    getInProgressQueues,
} = require('../controllers/queue-controllers.js');
const { Router } = require('express');

const router = Router();

router.get('/:departmentId', getAllWaitingDepartmentsQueue);
router.get('/specialist/:sessionId', getCurrentQueue);
router.get('/:departmentId/inprogress', getInProgressQueues);

module.exports = router;
