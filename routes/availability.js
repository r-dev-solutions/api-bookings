const express = require('express');
const Availability = require('../models/Availability');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public + authenticated: clients and editors can read open slots
router.get('/:date', async (req, res) => {
    try {
        const availability = await Availability.findOne({ date: new Date(req.params.date) });
        if (!availability) {
            return res.status(404).json({ message: 'No availability set for this date' });
        }
        res.json(availability);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Editor-dedicated: create/update day schedule and slot availability
router.put('/:date', authenticate, requireRole('editor'), async (req, res) => {
    try {
        const { timeSlots, isFullyBooked, isUnavailable } = req.body;
        const availability = await Availability.findOneAndUpdate(
            { date: new Date(req.params.date) },
            {
                date: new Date(req.params.date),
                timeSlots,
                isFullyBooked,
                isUnavailable
            },
            { new: true, upsert: true, runValidators: true }
        );
        res.json(availability);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Editor-dedicated: remove a day schedule
router.delete('/:date', authenticate, requireRole('editor'), async (req, res) => {
    try {
        const availability = await Availability.findOneAndDelete({ date: new Date(req.params.date) });
        if (!availability) {
            return res.status(404).json({ message: 'No availability set for this date' });
        }
        res.json({ message: 'Availability removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
