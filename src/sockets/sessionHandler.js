const Session = require('../models/session-model.js');
const Queue = require('../models/queue-model.js');
const User = require('../models/user-model.js');
const Department = require('../models/department-model.js');
const {
    getTicketTypeForSession,
} = require('../utils/helpers/queue-helpers.js');

module.exports = (io, socket) => {
    socket.on('start-service', async (data) => {
        const { sessionId, departmentId } = data;

        try {
            const session = await Session.findById(sessionId).exec();
            if (!session) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }

            const queue = await Queue.findById(session.currentQueue);
            if (!queue) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Тикет не найден',
                });
            }
            queue.status = 'in-progress';
            session.status = 'in-progress';
            queue.startServiceTime = new Date();
            const savedQueue = await queue.save();
            await session.save();

            socket.emit('ticket-in-progress-spec', {
                success: true,
                ticket: savedQueue,
                sessionStatus: session.status,
            });
            io.to(departmentId).emit('ticket-in-progress-spectator', {
                success: true,
                ticket: savedQueue,
                windowNumber: session.windowNumber,
            });
        } catch (error) {
            console.log(error);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при старте обслуживания клиента',
                errorMessage: error.message,
            });
        }
    });
    socket.on('ticket-skip', async (data) => {
        const { sessionId, departmentId, ticketsType } = data;
        try {
            const session = await Session.findById(sessionId).exec();
            if (!session) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }

            const queue = await Queue.findById(session.currentQueue);
            if (!queue) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Тикет не найден',
                });
            }

            queue.status = 'skipped';
            await queue.save();

            const formattedTicketType = getTicketTypeForSession(ticketsType);

            const department = await Department.findById(departmentId)
                .select('waitingQueues activeQueues')
                .populate({
                    path: 'waitingQueues',
                    match: { type: { $in: formattedTicketType } },
                });

            await Department.updateOne(
                { _id: departmentId },
                { $pull: { activeQueues: queue._id } },
            );

            if (department.waitingQueues.length > 0) {
                const assignedQueue = department.waitingQueues[0];
                await Department.updateOne(
                    { _id: departmentId },
                    {
                        $pull: { waitingQueues: assignedQueue._id },
                        $push: { activeQueues: assignedQueue._id },
                    },
                );

                assignedQueue.status = 'calling';
                assignedQueue.servicedBy = session._id;
                const savedQueue = await assignedQueue.save();

                session.currentQueue = savedQueue._id;
                session.isAvailable = false;
                session.status = 'calling';
                const savedSession = await session.save();

                socket.emit('ticket-calling-spec', {
                    success: true,
                    ticket: savedQueue,
                    session: savedSession,
                });
                io.to(departmentId).emit('ticket-calling-spectator', {
                    success: true,
                    ticket: savedQueue,
                    session: savedSession,
                });
            } else {
                session.isAvailable = true;
                session.currentQueue = null;
                session.status = 'available';
                session.availableSince = new Date();
                const savedSession = await session.save();

                socket.emit('specialist-available-spec', {
                    success: true,
                    session: savedSession,
                });
                io.to(departmentId).emit('specialist-available-spectator', {
                    success: true,
                    session: savedSession,
                });
            }
        } catch (error) {
            console.error(error);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при пропуске клиента',
                errorMessage: error.message,
            });
        }
    });

    socket.on('complete-ticket', async (data) => {
        const { sessionId, departmentId } = data;

        try {
            const session = await Session.findById(sessionId).exec();
            if (!session) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }

            const queue = await Queue.findById(session.currentQueue);
            if (!queue) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Тикет не найден',
                });
            }
            queue.status = 'completed';
            queue.endServiceTime = new Date();
            const savedQueue = await queue.save();

            const department = await Department.findById(departmentId);
            if (!department) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Департамент не найден',
                });
            }

            department.activeQueues.pull(queue._id);
            department.completedQueues.push(queue._id);
            await department.save();

            session.availableSince = new Date();
            session.currentQueue = null;
            session.status = 'serviced';
            const savedSession = await session.save();

            socket.emit('complete-ticket-spec', {
                success: true,
                ticket: savedQueue,
                session: savedSession,
            });
            io.to(departmentId).emit('complete-ticket-spectator', {
                success: true,
                ticket: savedQueue,
                session: savedSession,
            });
        } catch (error) {
            console.error(error);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        }
    });
    socket.on('ticket-next', async (data) => {
        const { sessionId, departmentId, ticketsType } = data;
        try {
            const session = await Session.findById(sessionId).exec();
            if (!session) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }

            const formattedTicketType = getTicketTypeForSession(ticketsType);

            const department = await Department.findById(departmentId)
                .select('waitingQueues activeQueues')
                .populate({
                    path: 'waitingQueues',
                    match: {
                        type: { $in: formattedTicketType },
                    },
                });

            if (department.waitingQueues.length > 0) {
                const assignedQueue = department.waitingQueues[0];

                const updatedAssignedQueue = await Queue.findOneAndUpdate(
                    { _id: assignedQueue._id },
                    { status: 'calling', servicedBy: session._id },
                    { new: true },
                );

                await Department.updateOne(
                    { _id: departmentId },
                    {
                        $pull: { waitingQueues: assignedQueue._id },
                        $push: { activeQueues: assignedQueue._id },
                    },
                );

                session.currentQueue = assignedQueue._id;
                session.isAvailable = false;
                session.status = 'calling';
                const savedSession = await session.save();

                socket.emit('ticket-calling-spec', {
                    success: true,
                    ticket: updatedAssignedQueue,
                    session: savedSession,
                });
                io.to(departmentId).emit('ticket-calling-spectator', {
                    success: true,
                    ticket: updatedAssignedQueue,
                    session: savedSession,
                });
                console.log('next client');
            } else {
                session.isAvailable = true;
                session.currentQueue = null;
                session.status = 'available';
                session.availableSince = new Date();
                const savedSession = await session.save();

                socket.emit('specialist-available-spec', {
                    success: true,
                    session: savedSession,
                });
                io.to(departmentId).emit('specialist-available-spectator', {
                    success: true,
                    session: savedSession,
                });
            }
        } catch (error) {
            console.error(error);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка при приёме следующего клиента',
                errorMessage: error.message,
            });
        }
    });

    socket.on('logout-specialist-backend', async (data) => {
        const { userId, sessionId, departmentId } = data;

        try {
            const foundUser = await User.findById(userId);
            if (!foundUser) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Пользователь не найден',
                });
            }
            const foundSession = await Session.findById(sessionId);
            if (!foundSession) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }

            if (foundUser.role === 'specialist') {
                const department =
                    await Department.findById(departmentId).select(
                        'activeQueues',
                    );
                department.activeQueues.pull(foundSession.currentQueue);
                await department.save();
                io.to(departmentId).emit('logout-specialist-frontend', {
                    windowNumber: foundSession.windowNumber,
                });
            }
            console.log(foundUser.role);
        } catch (error) {
            console.error(error.message);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка при выходе из системы',
                errorMessage: error.message,
            });
        }
    });

    socket.on('continue-work', async (data) => {
        const { sessionId, departmentId } = data;

        try {
            const session = await Session.findById(sessionId).exec();
            if (!session) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Сессия не найдена',
                });
            }
            const formattedTicketType = getTicketTypeForSession(
                session.ticketsType,
            );
            const ticket = await Queue.findOne({
                status: 'waiting',
                type: { $in: formattedTicketType },
                department: departmentId,
            })
                .sort({ createdAt: 1 })
                .exec();

            if (!ticket) {
                session.isAvailable = true;
                await session.save();
                socket.emit('available-specialist-spec', {
                    success: true,
                    availableStatus: true,
                });
            } else {
                session.currentQueue = ticket._id;
                session.isAvailable = false;
                await session.save();
                ticket.status = 'in-progress';
                const savedTicket = await ticket.save();
                socket.emit('ticket-in-progress-spec', {
                    success: true,
                    ticket: savedTicket,
                    windowNumber: session.windowNumber,
                });
                io.to(departmentId).emit('ticket-in-progress', {
                    success: true,
                    ticket: savedTicket,
                    windowNumber: session.windowNumber,
                });
            }
        } catch (error) {
            console.error('Ошибка при продолжении работы:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        }
    });

    socket.on('call-again', async (data) => {
        try {
            const { ticket, sessionId, departmentId } = data;
            const foundSession =
                await Session.findById(sessionId).populate('currentQueue');

            if (!foundSession) {
                socket.emit('ticket-error', {
                    success: false,
                    message: 'Такой сессии нет',
                });
                return;
            }

            if (!foundSession.currentQueue) {
                socket.emit('ticket-error', {
                    success: false,
                    message: 'У специалиста нет клиента',
                });
                return;
            }

            io.to(departmentId).emit('call-again-spect', {
                windowNumber: foundSession.windowNumber,
                ticket: foundSession.currentQueue,
            });
        } catch (error) {
            console.error('Ошибка при зове клиента повторно:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        }
    });
};
