const Department = require('../models/department-model.js');
const Queue = require('../models/queue-model.js');
const Session = require('../models/session-model.js');
const { getRightTicketType } = require('../utils/helpers/queue-helpers.js');

module.exports = (io, socket) => {
    socket.on('add-new-ticket', async (data) => {
        const { departmentId, ticketType, timestamp } = data;

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const department = await Department.findById(departmentId);

            if (!department) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Филиал не найден',
                });
            }

            if (!department.ticketCounters) {
                return socket.emit('ticket-error', {
                    success: false,
                    message: 'Ошибка в модели филиала',
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
                department.ticketCounters.TSY = 0;
                department.ticketCounters.TSF = 0;
                department.ticketCounters.GR = 0;
                department.ticketCounters.VS = 0;
                department.ticketCounters.lastResetDate = today;
            }

            department.ticketCounters[ticketType] += 1;

            const ticketNumber = `${ticketType}${String(department.ticketCounters[ticketType]).padStart(4, '0')}`;

            const newTicket = new Queue({
                type: ticketType,
                ticketNumber: ticketNumber,
                createdAt: timestamp || Date.now(),
                department: department._id,
                status: 'waiting',
            });

            const savedTicket = await newTicket.save();

            department.queues.push(savedTicket._id);

            await department.save();

            const ticketForSession = getRightTicketType(ticketType);

            const availableSessions = await Session.find({
                ticketsType: ticketForSession,
                isAvailable: true,
                department: departmentId,
            })
                .sort({ availableSince: 1 })
                .exec();

            if (availableSessions.length > 0) {
                const assignedSession = availableSessions[0];
                assignedSession.currentQueue = savedTicket._id;
                assignedSession.isAvailable = false;
                assignedSession.status = 'calling';
                await assignedSession.save();

                savedTicket.status = 'calling';
                await savedTicket.save();

                const waitingQueues = await Queue.find({
                    department: departmentId,
                    type: ticketType,
                    status: 'waiting',
                });

                const hasQueues = waitingQueues.length > 0 ? false : true;

                socket.emit('ticket-in-progress', {
                    success: true,
                    message: 'Клиент успешно вызван к специалисту',
                    ticket: savedTicket,
                    departmentName: department.name,
                    hasQueues,
                });

                io.to(departmentId).emit('ticket-calling-spect', {
                    success: true,
                    ticket: savedTicket,
                    windowNumber: assignedSession.windowNumber,
                    // hasQueues,
                });

                io.to(assignedSession._id.toString()).emit(
                    'ticket-calling-spec',
                    {
                        success: true,
                        ticket: savedTicket,
                        session: assignedSession,
                        // hasQueues,
                    },
                );

                console.log(
                    `Тикет ${savedTicket.ticketNumber} назначен специалисту ${assignedSession.userInfo}`,
                );
            } else {
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
            console.error('Ошибка при добавлении тикета:', error.message);
            socket.emit('ticket-error', {
                success: false,
                message: error.message,
            });
        }
    });
};
