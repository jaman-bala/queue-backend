const Session = require('../models/session-model.js');
const Queue = require('../models/queue-model.js');
const User = require('../models/user-model.js');

module.exports = (io, socket) => {
    socket.on('complete-ticket', async (data) => {
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
            queue.status = 'completed';
            await queue.save();

            console.log(queue);

            const availableQueues = await Queue.find({
                type: ticketsType,
                status: 'waiting',
                department: departmentId,
            })
                .sort({ createdAt: 1 })
                .exec();

            if (availableQueues.length > 0) {
                const assignedQueue = availableQueues[0];
                assignedQueue.status = 'in-progress';
                await assignedQueue.save();

                session.isAvailable = false;
                session.currentQueue = assignedQueue._id;
                session.availableSince = new Date();
                await session.save();
                socket.emit('ticket-in-progress-spec', {
                    success: true,
                    ticket: assignedQueue,
                });
                io.to(departmentId).emit('ticket-in-progress', {
                    success: true,
                    ticket: assignedQueue,
                    windowNumber: session.windowNumber,
                });

                console.log(
                    `Тикет ${assignedQueue.ticketNumber} назначен специалисту ${session.userInfo}`,
                );
            } else {
                session.isAvailable = true;
                session.currentQueue = null;
                session.availableSince = new Date();
                await session.save();
                socket.emit('specialist-available-spec', {
                    success: true,
                    sessionId: session._id,
                });
                io.to(departmentId).emit('specialist-available', {
                    success: true,
                    sessionId: session._id,
                    windowNumber: session.windowNumber,
                });
                console.log(`Специалист ${session.userInfo} снова доступен`);
            }
        } catch (error) {
            console.error('Ошибка при завершении тикета:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        }
    });

    socket.on('take-pause', async (data) => {
        const { sessionId } = data;

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
            await queue.save();

            session.isAvailable = false;
            session.currentQueue = null;
            session.availableSince = new Date();
            await session.save();
            socket.emit('take-pause-specialist', {
                success: true,
                availableStatus: false,
            });
            io.to(departmentId).emit('take-pause-specialist', {
                windowNumber: session.windowNumber,
            });
        } catch (error) {
            console.error('Ошибка при взятии паузы:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
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
            console.error('Ошибка при продолжении работы:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
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
            const ticket = await Queue.findOne({
                status: 'waiting',
                type: session.ticketsType,
                department: departmentId,
            })
                .sort({ createdAt: 1 })
                .exec();
            if (!ticket) {
                session.isAvailable = true;
                await session.save();
                socket.emit('available-specialist', {
                    success: true,
                    availableStatus: true,
                });
            } else {
                session.currentQueue = ticket._id;
                session.isAvailable = false;
                await session.save();
                ticket.status = 'in-progress';
                const savedTicket = await ticket.save();
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
