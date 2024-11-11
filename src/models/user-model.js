const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ['operator', 'specialist', 'spectator', 'admin'],
        required: true,
    },
    password: { type: String, required: true },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    isAvailable: { type: Boolean, default: true },
    ticketsType: { type: String, enum: ['TS', 'VS'] },
    status: {
        type: String,
        enum: ['available', 'calling', 'in-progress', 'serviced'],
    },
    windowNumber: { type: Number },
    currentQueue: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue' },
    availableSince: { type: Date },
});

module.exports = mongoose.model('User', userSchema);
