const Session = require('../models/session-model');
const Department = require('../models/department-model');
const Queue = require('../models/queue-model');

const getAllWaitingDepartmentsQueue = async (req, res) => {
    const { departmentId } = req.params;

    try {
        const department = await Department.findById(departmentId);

        if (!department) {
            return res.status(400).json({ message: 'Нет такого филиала' });
        }

        // const sessions = await Session.find({
        //     department: department._id,
        //     currentQueue: { $ne: null },
        // })
        //     .populate('currentQueue')
        //     .sort({ availableSince: -1 })
        //     .lean();

        const sessions = await Session.find({
            department: department._id,
            currentQueue: { $ne: null },
            endTime: null,
        })
            .populate({
                path: 'userInfo',
                match: { role: 'specialist' },
            })
            .populate('currentQueue')
            .sort({ availableSince: -1 })
            .lean();

        const queues = await Queue.find({
            department: departmentId,
            status: 'waiting',
        })
            .sort({ createdAt: 1 })
            .lean();

        if (!queues || (queues.length === 0 && !sessions)) {
            return res.status(200).json({ message: 'Очереди нет' });
        }

        const tsFTickets = queues.filter((queue) => queue.type === 'TSF');
        const tsYTickets = queues.filter((queue) => queue.type === 'TSY');
        const vsTickets = queues.filter((queue) => queue.type === 'VS');
        const grTickets = queues.filter((queue) => queue.type === 'GR');

        const inProgressTickets = sessions.map((session) => ({
            windowNumber: session.windowNumber,
            ticketNumber: session.currentQueue.ticketNumber,
        }));

        res.status(200).json({
            success: true,
            tsFTickets,
            tsYTickets,
            vsTickets,
            grTickets,
            inProgressTickets,
            sessions,
        });
    } catch (error) {
        console.error('Ошибка при получении очереди:', error.message);
        res.status(500).json({ message: 'Ошибка на сервере' });
    }
};

const getCurrentQueue = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(400).json({ message: 'Нет такой сессии' });
        }

        const queue = await Queue.findById(session.currentQueue);

        if (!queue) {
            return res
                .status(200)
                .json({ message: 'Специалист свободен', next: true });
        }

        res.status(200).json({
            success: true,
            queue,
        });
    } catch (error) {
        console.error('Ошибка при получении тикета:', error.message);
        res.status(500).json({ message: 'Ошибка на сервере' });
    }
};

module.exports = { getAllWaitingDepartmentsQueue, getCurrentQueue };
