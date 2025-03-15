const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
    time: String,
    available: Boolean
});

const dayAvailabilitySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    timeSlots: [timeSlotSchema],
    isFullyBooked: Boolean,
    isUnavailable: Boolean
});

module.exports = mongoose.model('Availability', dayAvailabilitySchema);