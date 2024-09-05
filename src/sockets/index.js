const ticketHandler = require('./ticketHandler.js');
const sessionHandler = require('./sessionHandler.js');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('Connected');
        socket.on('join-department', (departmentId) => {
            console.log('DepartmentId connected ' + departmentId);
            socket.join(departmentId);
        });
        ticketHandler(io, socket);
        sessionHandler(io, socket);
        socket.on('disconnect', () => {
            console.log('A user disconnected');
        });
    });
};
