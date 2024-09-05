const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
    queues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    ticketCounters: {
        TS: { type: Number, default: 0 },
        VS: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
    },
});

module.exports = mongoose.model('Department', departmentSchema);
