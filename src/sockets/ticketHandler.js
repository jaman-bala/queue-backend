const Department = require('../models/department-model.js');
const Queue = require('../models/queue-model.js');
const User = require('../models/user-model.js');
const {
    getRightTicketType,
    getTranslatedTicketType,
} = require('../utils/helpers/queue-helpers.js');

module.exports = (io, socket) => {
    const mongoose = require('mongoose');

    socket.on('add-new-ticket', async (data) => {
        const { departmentId, ticketType, timestamp } = data;
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const department =
                await Department.findById(departmentId).session(session);
            if (!department) {
                await session.abortTransaction();
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Филиал не найден',
                });
            }

            if (
                new Date(department.ticketCounters.lastResetDate).setHours(
                    0,
                    0,
                    0,
                    0,
                ) < today.getTime()
            ) {
                department.ticketCounters = {
                    TSY: 0,
                    TSF: 0,
                    GR: 0,
                    VS: 0,
                    lastResetDate: today,
                };
            }

            department.ticketCounters[ticketType] += 1;
            const translatedTicketType = getTranslatedTicketType(ticketType);
            const ticketNumber = `${translatedTicketType}${String(department.ticketCounters[ticketType]).padStart(4, '0')}`;

            const newTicket = new Queue({
                type: ticketType,
                ticketNumber: ticketNumber,
                createdAt: timestamp || Date.now(),
                departmentId: department._id,
                status: 'waiting',
            });

            const savedTicket = await newTicket.save({ session });
            await department.save({ session });

            const rightTicket = getRightTicketType(ticketType);

            const availableSpecialist = await User.findOneAndUpdate(
                {
                    role: 'specialist',
                    ticketsType: rightTicket,
                    isAvailable: true,
                    status: 'available',
                    departmentId: departmentId,
                },
                {
                    $set: {
                        currentQueue: savedTicket._id,
                        isAvailable: false,
                        status: 'calling',
                    },
                },
                {
                    new: true,
                    session,
                    sort: { availableSince: 1 },
                },
            );

            console.log(availableSpecialist);

            if (availableSpecialist) {
                savedTicket.status = 'calling';
                savedTicket.servicedBy = availableSpecialist._id;
                await savedTicket.save({ session });

                await session.commitTransaction();

                socket.emit('ticket-in-progress', {
                    success: true,
                    message: 'Клиент успешно вызван к специалисту',
                    ticket: savedTicket,
                    departmentName: department.name,
                });

                io.to(departmentId).emit('ticket-calling-spect', {
                    success: true,
                    ticket: savedTicket,
                    windowNumber: availableSpecialist.windowNumber,
                });

                io.to(availableSpecialist._id.toString()).emit(
                    'ticket-calling-spec',
                    {
                        success: true,
                        ticket: savedTicket,
                        specialist: availableSpecialist,
                    },
                );

                console.log(
                    `Тикет ${savedTicket.ticketNumber} назначен специалисту ${availableSpecialist.name}`,
                );
            } else {
                await session.commitTransaction();

                socket.emit('ticket-added', {
                    success: true,
                    ticket: savedTicket,
                    departmentName: department.name,
                });

                io.to(departmentId).emit('ticket-added-spect', {
                    ticket: savedTicket,
                });

                console.log(
                    `Тикет ${savedTicket.ticketNumber} добавлен в филиал ${department.name}`,
                );
            }
        } catch (error) {
            await session.abortTransaction();
            console.error('Ошибка при добавлении тикета:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        } finally {
            session.endSession();
        }
    });
};
