const Session = require('../models/session-model');
const Department = require('../models/department-model');
const Queue = require('../models/queue-model');
const mongoose = require('mongoose');
const {
    getTicketTypeForSession,
} = require('../utils/helpers/queue-helpers.js');

const getAllWaitingDepartmentsQueue = async (req, res) => {
    const { departmentId } = req.params;

    try {
        const department = await Department.findById(departmentId);

        if (!department) {
            return res.status(400).json({ message: 'Нет такого филиала' });
        }

        const lastQueues = await Queue.aggregate([
            {
                $match: {
                    department: new mongoose.Types.ObjectId(departmentId),
                    status: 'waiting',
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: '$type',
                    lastQueue: { $first: '$$ROOT' },
                },
            },
            {
                $replaceRoot: { newRoot: '$lastQueue' },
            },
        ]);

        if (lastQueues.length === 0) {
            return res.status(204).json({ message: 'Очереди нет' });
        }

        res.status(200).json(lastQueues);

        console.log(lastQueues);
    } catch (error) {
        console.error('Ошибка при получении очереди:', error.message);
        res.status(500).json({ message: 'Ошибка на сервере' });
    }
};

const getCurrentQueue = async (req, res) => {
    const { sessionId } = req.params;
    const { departmentId } = req.query;
    try {
        const session = await Session.findById(sessionId);

        if (!session) {
            return res.status(400).json({ message: 'Нет такой сессии' });
        }

        const queue = await Queue.findById(session.currentQueue);
        console.log(queue);

        if (!queue) {
            const formattedTicketType = getTicketTypeForSession(
                session.ticketsType,
            );

            const availableQueues = await Queue.find({
                type: { $in: formattedTicketType },
                status: 'waiting',
                department: departmentId,
            })
                .sort({ createdAt: 1 })
                .exec();

            if (availableQueues.length > 0) {
                const assignedQueue = availableQueues[0];
                assignedQueue.status = 'calling';
                const savedQueue = await assignedQueue.save();

                session.currentQueue = savedQueue._id;
                session.isAvailable = false;
                session.status = 'calling';
                const savedSession = await session.save();

                return res.status(200).json({
                    ticket: savedQueue,
                    session: savedSession,
                });
            } else {
                session.isAvailable = true;
                session.currentQueue = null;
                session.status = 'available';
                session.availableSince = new Date();
                const savedSession = await session.save();

                return res.status(200).json({
                    session: savedSession,
                    ticket: false,
                });
            }
        }

        res.status(200).json({
            success: true,
            ticket: queue,
            session,
        });
    } catch (error) {
        console.error('Ошибка при получении тикета:', error.message);
        res.status(500).json({ message: 'Ошибка на сервере' });
    }
};

const getInProgressQueues = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const foundDepartment = await Department.findById(departmentId);
        if (!foundDepartment) {
            res.status(404).json({ message: 'Нет такого филиала' });
        }
        const sessions = await Session.find({
            department: foundDepartment._id,
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

        if (sessions.length === 0) {
            return res.status(204).json({
                message: 'Нет клиентов, которые сейчас обслуживаются',
            });
        }

        const inProgressTickets = sessions.map((session) => ({
            ...session.currentQueue,
            windowNumber: session.windowNumber,
        }));

        res.status(200).json(inProgressTickets);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message:
                'Ошибка при получении тикетов, которые сейчас обслуживаются',
            errorMessage: error,
        });
    }
};

module.exports = {
    getAllWaitingDepartmentsQueue,
    getCurrentQueue,
    getInProgressQueues,
};
