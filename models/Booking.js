const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    time: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    company: String,
    topic: { type: String, required: true },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['confirmed', 'cancelled', 'completed', 'no-show'],
        default: 'confirmed'
    },
    notes: { type: String, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
