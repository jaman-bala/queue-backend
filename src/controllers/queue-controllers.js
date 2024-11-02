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

        if (!queue) {
            const formattedTicketType = getTicketTypeForSession(
                session.ticketsType,
            );

            const department = await Department.findById(departmentId)
                .select('waitingQueues activeQueues')
                .populate({
                    path: 'waitingQueues',
                    match: {
                        type: { $in: formattedTicketType },
                    },
                });

            if (department.waitingQueues.length > 0) {
                console.log('ssssssssssssss');
                // Извлекаем и удаляем первый элемент из waitingQueues
                const assignedQueue = department.waitingQueues[0];

                // Обновляем статус и данные assignedQueue через `updateOne`
                await Queue.updateOne(
                    { _id: assignedQueue._id },
                    { status: 'calling', servicedBy: session._id },
                );

                // Обновляем данные сессии
                await Session.updateOne(
                    { _id: session._id },
                    {
                        currentQueue: assignedQueue._id,
                        isAvailable: false,
                        status: 'calling',
                    },
                );

                // Переносим очередь в activeQueues департамента
                await Department.updateOne(
                    { _id: departmentId },
                    {
                        $pull: { waitingQueues: { _id: assignedQueue._id } },
                        $push: { activeQueues: assignedQueue._id },
                    },
                );

                return res.status(200).json({
                    ticket: assignedQueue,
                    session: {
                        ...session.toObject(),
                        currentQueue: assignedQueue._id,
                        isAvailable: false,
                        status: 'calling',
                    },
                });
            } else {
                // Обновляем статус сессии как `доступный`
                await Session.updateOne(
                    { _id: session._id },
                    {
                        isAvailable: true,
                        currentQueue: null,
                        status: 'available',
                        availableSince: new Date(),
                    },
                );

                return res.status(200).json({
                    session: {
                        ...session.toObject(),
                        isAvailable: true,
                        currentQueue: null,
                        status: 'available',
                        availableSince: new Date(),
                    },
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
        const foundDepartment = await Department.findById(
            departmentId,
        ).populate({
            path: 'activeQueues',
            populate: { path: 'servicedBy', select: 'windowNumber' },
        });
        if (!foundDepartment) {
            res.status(404).json({ message: 'Нет такого филиала' });
        }
        if (foundDepartment.length === 0) {
            return res.status(204).json({
                message: 'Нет клиентов, которые сейчас обслуживаются',
            });
        }
        const sortedActiveQueues = foundDepartment.activeQueues
            .sort((a, b) => {
                if (a.status === 'calling' && b.status !== 'calling') return -1;
                if (a.status !== 'calling' && b.status === 'calling') return 1;
                return 0;
            })
            .map((queue) => ({
                ticketNumber: queue.ticketNumber,
                status: queue.status,
                windowNumber: queue.servicedBy
                    ? queue.servicedBy.windowNumber
                    : null,
            }));

        res.json(sortedActiveQueues);
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
