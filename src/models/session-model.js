const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
    },
    ticketsType: { type: String, enum: ['TS', 'VS'] },
    tickets: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Queue',
        },
    ],
    windowNumber: { type: Number },
    currentQueue: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    isAvailable: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['available', 'calling', 'in-progress', 'serviced'],
    },
    acceptedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    skippedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
    availableSince: { type: Date },
});

module.exports = mongoose.model('Session', sessionSchema);
