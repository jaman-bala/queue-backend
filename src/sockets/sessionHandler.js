const Session = require('../models/session-model.js');
const Queue = require('../models/queue-model.js');
const User = require('../models/user-model.js');
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
            console.log(error);
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
};
