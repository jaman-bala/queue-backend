const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
    waitingQueues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    completedQueues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    activeQueues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    ticketCounters: {
        TSY: { type: Number, default: 0 },
        TSF: { type: Number, default: 0 },
        VS: { type: Number, default: 0 },
        GR: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
    },
});

module.exports = mongoose.model('Department', departmentSchema);
