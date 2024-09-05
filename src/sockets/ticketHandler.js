const Department = require('../models/department-model.js');
const Queue = require('../models/queue-model..js');
const Session = require('../models/session-model.js');

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
                department.ticketCounters.TS = 0;
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

            const availableSessions = await Session.find({
                ticketsType: ticketType,
                isAvailable: true,
                department: departmentId,
            })
                .sort({ availableSince: 1 })
                .exec();

            if (availableSessions.length > 0) {
                const assignedSession = availableSessions[0];
                assignedSession.currentQueue = savedTicket._id;
                assignedSession.isAvailable = false;
                assignedSession.availableSince = new Date();
                await assignedSession.save();

                savedTicket.status = 'in-progress';
                await savedTicket.save();

                const waitingQueues = await Queue.find({
                    department: departmentId,
                    type: ticketType,
                    status: 'waiting',
                });

                const hasQueues = waitingQueues.length > 0 ? false : true;

                io.to(departmentId).emit('ticket-in-progress', {
                    success: true,
                    ticket: savedTicket,
                    windowNumber: assignedSession.windowNumber,
                    hasQueues,
                });

                console.log(
                    `Тикет ${savedTicket.ticketNumber} назначен специалисту ${assignedSession.userInfo}`,
                );
            } else {
                socket.emit('ticket-added', {
                    success: true,
                    ticket: savedTicket,
                });
                io.to(departmentId).emit('new-ticket', savedTicket);

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
