const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
    type: { type: String, enum: ['TSF', 'TSY', 'VS', 'GR'], required: true },
    ticketNumber: { type: String, required: true },
    status: {
        type: String,
        enum: ['waiting', 'calling', 'in-progress', 'completed', 'skipped'],
        default: 'waiting',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    startServiceTime: {
        type: Date,
    },
    endServiceTime: {
        type: Date,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
});

module.exports = mongoose.model('Queue', queueSchema);