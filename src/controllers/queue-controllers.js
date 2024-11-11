const User = require('../models/user-model');
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
    const { userId } = req.params;
    const { departmentId } = req.query;
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Нет такого пользователя' });
        }

        let queue = await Queue.findById(user.currentQueue).session(session);

        if (!queue) {
            const formattedTicketType = getTicketTypeForSession(
                user.ticketsType,
            );

            queue = await Queue.findOneAndUpdate(
                {
                    departmentId: new mongoose.Types.ObjectId(departmentId),
                    status: 'waiting',
                    type: { $in: formattedTicketType },
                },
                {
                    $set: { status: 'calling', servicedBy: user._id },
                },
                {
                    new: true,
                    session,
                    sort: { createdAt: 1 },
                },
            );

            if (!queue) {
                await User.findByIdAndUpdate(
                    userId,
                    {
                        isAvailable: true,
                        currentQueue: null,
                        status: 'available',
                    },
                    { session },
                );

                await session.commitTransaction();

                return res.status(200).json({
                    session: {
                        ...user.toObject(),
                        isAvailable: true,
                        currentQueue: null,
                        status: 'available',
                    },
                    ticket: false,
                });
            }

            await User.findByIdAndUpdate(
                userId,
                {
                    currentQueue: queue._id,
                    isAvailable: false,
                    status: 'calling',
                },
                { session },
            );

            user.currentQueue = queue._id;
            user.isAvailable = false;
            user.status = 'calling';
        }

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            ticket: queue,
            session: {
                ...user.toObject(),
                currentQueue: user.currentQueue,
                isAvailable: user.isAvailable,
                status: user.status,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Ошибка при получении тикета:', error.message);
        res.status(500).json({ message: 'Ошибка на сервере' });
    } finally {
        session.endSession();
    }
};

const getInProgressQueues = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const currentQueues = await User.find({
            currentQueue: { $ne: null },
            departmentId: new mongoose.Types.ObjectId(departmentId),
        })
            .populate({
                path: 'currentQueue',
                select: 'ticketNumber status',
            })
            .select('_id windowNumber currentQueue');

        if (currentQueues.length === 0) {
            return res.status(204).json({
                message: 'Нет клиентов, которые сейчас обслуживаются',
            });
        }

        const sortedCurrentQueues = currentQueues
            .sort((a, b) => {
                if (a.status === 'calling' && b.status !== 'calling') return -1;
                if (a.status !== 'calling' && b.status === 'calling') return 1;
                return 0;
            })
            .map((item) => ({
                _id: item._id,
                ticketNumber: item.currentQueue.ticketNumber,
                status: item.currentQueue.status,
                windowNumber: item.windowNumber,
            }));

        res.json(sortedCurrentQueues);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message:
                'Ошибка при получении тикетов, которые сейчас обслуживаются',
            errorMessage: error,
        });
    }
};

const completeSession = async (req, res) => {
    const { sessionId } = req.body;

    const foundSession = await Session.findById(sessionId);
    foundSession.endTime = new Date();
    foundSession.isAvailable = false;
    foundSession.status = 'available';

    const foundQueue = await Queue.findById(foundSession.currentQueue);
    foundQueue.status = 'completed';
    foundQueue.endServiceTime = new Date();
    await foundQueue.save();
    foundSession.currentQueue = null;
    await foundSession.save();
};

module.exports = {
    getAllWaitingDepartmentsQueue,
    getCurrentQueue,
    getInProgressQueues,
};
