const express = require('express');
const Availability = require('../models/Availability');
const router = express.Router();

// Get availability for a specific date
router.get('/:date', async (req, res) => {
    try {
        const availability = await Availability.findOne({ date: req.params.date });
        res.json(availability);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update availability
router.put('/:date', async (req, res) => {
    try {
        const availability = await Availability.findOneAndUpdate(
            { date: req.params.date },
            req.body,
            { new: true, upsert: true }
        );
        res.json(availability);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;