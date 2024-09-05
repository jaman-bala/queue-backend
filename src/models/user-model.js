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
    active: { type: Boolean, default: true },
});

module.exports = mongoose.model('User', userSchema);
