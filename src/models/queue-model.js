const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
    type: { type: String, enum: ['TSF', 'TSY', 'VS', 'GR'], required: true },
    ticketNumber: { type: String, required: true },
    status: {
        type: String,
        enum: ['waiting', 'in-progress', 'completed'],
        default: 'waiting',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
});

module.exports = mongoose.model('Queue', queueSchema);
