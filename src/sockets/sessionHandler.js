const Queue = require('../models/queue-model.js');
const User = require('../models/user-model.js');
const Department = require('../models/department-model.js');
const mongoose = require('mongoose');
const {
    getTicketTypeForSession,
} = require('../utils/helpers/queue-helpers.js');

module.exports = (io, socket) => {
    socket.on('start-service', async (data) => {
        const { userId, departmentId } = data;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const user = await User.findById(userId).session(session);
            if (!user) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Пользователь не найден',
                });
            }

            if (!user.currentQueue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Талон не найден у специалиста',
                });
            }

            const queue = await Queue.findById(user.currentQueue).session(
                session,
            );
            if (!queue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Талон не найден',
                });
            }

            queue.status = 'in-progress';
            queue.startServiceTime = new Date();
            const savedQueue = await queue.save({ session });

            user.status = 'in-progress';
            await user.save({ session });

            await session.commitTransaction();

            socket.emit('ticket-in-progress-spec', {
                success: true,
                ticket: savedQueue,
                userStatus: user.status,
            });

            io.to(departmentId).emit('ticket-in-progress-spectator', {
                success: true,
                ticket: savedQueue,
                windowNumber: user.windowNumber,
            });
        } catch (error) {
            await session.abortTransaction();
            console.error(
                'Ошибка при старте обслуживания клиента:',
                error.message,
            );
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при старте обслуживания клиента',
                errorMessage: error.message,
            });
        } finally {
            session.endSession();
        }
    });

    socket.on('ticket-skip', async (data) => {
        const { userId, departmentId, ticketsType } = data;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const user = await User.findById(userId).session(session);
            if (!user) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Пользователь не найден',
                });
            }

            if (!user.currentQueue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Нет текущего талона у специалиста',
                });
            }

            const queue = await Queue.findById(user.currentQueue).session(
                session,
            );
            if (!queue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Талон не найден',
                });
            }

            queue.status = 'skipped';
            await queue.save({ session });

            user.currentQueue = null;

            const formattedTicketType = getTicketTypeForSession(ticketsType);
            const nextQueue = await Queue.findOneAndUpdate(
                {
                    departmentId: new mongoose.Types.ObjectId(departmentId),
                    type: { $in: formattedTicketType },
                    status: 'waiting',
                },
                {
                    $set: {
                        status: 'calling',
                        servicedBy: user._id,
                    },
                },
                {
                    new: true,
                    session,
                    sort: { createdAt: 1 },
                },
            );

            if (nextQueue) {
                user.currentQueue = nextQueue._id;
                user.status = 'calling';
                user.isAvailable = false;

                await user.save({ session });

                await session.commitTransaction();

                socket.emit('ticket-calling-spec', {
                    success: true,
                    ticket: nextQueue,
                    specialist: user,
                });

                io.to(departmentId).emit('ticket-calling-spectator', {
                    success: true,
                    ticket: nextQueue,
                    windowNumber: user.windowNumber,
                });
            } else {
                user.status = 'available';
                user.isAvailable = true;
                user.availableSince = new Date();

                await user.save({ session });

                await session.commitTransaction();

                socket.emit('specialist-available-spec', {
                    success: true,
                    specialist: user,
                });

                io.to(departmentId).emit('specialist-available-spectator', {
                    success: true,
                    specialist: user,
                });
            }
        } catch (error) {
            await session.abortTransaction();
            console.error('Ошибка при пропуске клиента:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при пропуске клиента',
                errorMessage: error.message,
            });
        } finally {
            session.endSession();
        }
    });

    socket.on('complete-ticket', async (data) => {
        const { userId, departmentId } = data;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const user = await User.findById(userId).session(session);
            if (!user) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Пользователь не найден',
                });
            }

            if (!user.currentQueue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Текущий талон не найден у специалиста',
                });
            }

            const queue = await Queue.findById(user.currentQueue).session(
                session,
            );

            if (!queue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Талон не найден',
                });
            }

            queue.status = 'completed';
            queue.endServiceTime = new Date();
            const savedQueue = await queue.save({ session });

            const department =
                await Department.findById(departmentId).session(session);
            if (!department) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Департамент не найден',
                });
            }

            user.availableSince = new Date();
            user.currentQueue = null;
            user.status = 'serviced';
            await user.save({ session });

            await session.commitTransaction();

            socket.emit('complete-ticket-spec', {
                success: true,
                ticket: savedQueue,
                specialist: user,
            });

            io.to(departmentId).emit('complete-ticket-spectator', {
                success: true,
                ticket: savedQueue,
                specialist: user,
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Ошибка при завершении талона:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при завершении талона',
                errorMessage: error.message,
            });
        } finally {
            session.endSession();
        }
    });

    socket.on('ticket-next', async (data) => {
        const { userId, departmentId, ticketsType } = data;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const user = await User.findById(userId).session(session);
            if (!user) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Пользователь не найден',
                });
            }

            const formattedTicketType = getTicketTypeForSession(ticketsType);

            const department =
                await Department.findById(departmentId).session(session);
            if (!department) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Департамент не найден',
                });
            }

            const nextQueue = await Queue.findOneAndUpdate(
                {
                    departmentId: new mongoose.Types.ObjectId(departmentId),
                    type: { $in: formattedTicketType },
                    status: 'waiting',
                },
                {
                    $set: {
                        status: 'calling',
                        servicedBy: user._id,
                    },
                },
                {
                    new: true,
                    session,
                    sort: { createdAt: 1 },
                },
            );

            if (nextQueue) {
                user.currentQueue = nextQueue._id;
                user.status = 'calling';
                user.isAvailable = false;

                await user.save({ session });

                await session.commitTransaction();

                socket.emit('ticket-calling-spec', {
                    success: true,
                    ticket: nextQueue,
                    specialist: user,
                });

                io.to(departmentId).emit('ticket-calling-spectator', {
                    success: true,
                    ticket: nextQueue,
                    windowNumber: user.windowNumber,
                });
            } else {
                user.status = 'available';
                user.isAvailable = true;
                user.currentQueue = null;
                user.availableSince = new Date();

                await user.save({ session });

                await session.commitTransaction();

                socket.emit('specialist-available-spec', {
                    success: true,
                    specialist: user,
                });

                io.to(departmentId).emit('specialist-available-spectator', {
                    success: true,
                    specialist: user,
                });
            }
        } catch (error) {
            await session.abortTransaction();
            console.error(
                'Ошибка при приёме следующего клиента:',
                error.message,
            );
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка сервера при приёме следующего клиента',
                errorMessage: error.message,
            });
        } finally {
            session.endSession();
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
        const session = await mongoose.startSession();
        try {
            const { userId, departmentId } = data;
            session.startTransaction();

            const user = await User.findById(userId)
                .populate('currentQueue')
                .session(session);

            if (!user) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Такого специалиста нет',
                });
            }

            if (!user.currentQueue) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'У специалиста нет клиента',
                });
            }

            await session.commitTransaction();

            console.log(departmentId);

            io.to(departmentId).emit('call-again-spect', {
                windowNumber: user.windowNumber,
                ticket: user.currentQueue,
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Ошибка при зове клиента повторно:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: 'Ошибка при зове клиента повторно',
                errorMessage: error.message,
            });
        } finally {
            session.endSession();
        }
    });
};
