const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/auth-routes.js');
const socketHandler = require('./sockets/index.js');
const departmentRoutes = require('./routes/department-routes.js');
const queueRoutes = require('./routes/queue-routes.js');
const usersRoutes = require('./routes/user-routes.js');

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: 'https://e-queue.tsvs.kg',
});
const port = process.env.PORT || 5000;

let counter = 0;

app.use((req, res, next) => {
    counter += 1;
    console.log(`${req.method} ${req.url} ${counter}`);
    next();
});

app.use(
    cors({
        origin: 'https://e-queue.tsvs.kg',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    }),
);
app.use(express.json());
app.use(cookieParser());
app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/auth', authRoutes);
app.use('/departments', departmentRoutes);
app.use('/queues', queueRoutes);
app.use('/users', usersRoutes);

socketHandler(io);

mongoose.connect(process.env.DB_URI);

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
    server.listen(port, () =>
        console.log(`[server]: Server is running at http://localhost:${port}`),
    );
});
