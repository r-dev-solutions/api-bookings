const express = require('express');
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

async function markSlotBooked(date, time) {
    const day = await Availability.findOne({ date: new Date(date) });
    if (!day) return;

    let changed = false;
    for (const slot of day.timeSlots || []) {
        if (slot.time === time && slot.available) {
            slot.available = false;
            changed = true;
        }
    }

    if (changed) {
        day.isFullyBooked = day.timeSlots.every((slot) => !slot.available);
        await day.save();
    }
}

async function releaseSlot(date, time) {
    const day = await Availability.findOne({ date: new Date(date) });
    if (!day) return;

    for (const slot of day.timeSlots || []) {
        if (slot.time === time) {
            slot.available = true;
        }
    }
    day.isFullyBooked = day.timeSlots.every((slot) => !slot.available);
    await day.save();
}

// Client: list own bookings
router.get('/me', authenticate, requireRole('client'), async (req, res) => {
    try {
        const bookings = await Booking.find({ clientId: req.user._id }).sort({ date: 1, time: 1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Editor: list all bookings (optional status filter)
router.get('/', authenticate, requireRole('editor'), async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.clientId) filter.clientId = req.query.clientId;
        const bookings = await Booking.find(filter).sort({ date: 1, time: 1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Shared get-by-id with ownership check for clients
router.get('/:id', authenticate, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (req.user.role === 'client' && String(booking.clientId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Forbidden for this login' });
        }

        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Client: create a booking for themselves
router.post('/', authenticate, requireRole('client'), async (req, res) => {
    try {
        const { date, time, topic, company } = req.body;
        if (!date || !time || !topic) {
            return res.status(400).json({ message: 'date, time, and topic are required' });
        }

        const day = await Availability.findOne({ date: new Date(date) });
        if (!day || day.isUnavailable) {
            return res.status(400).json({ message: 'Selected date is unavailable' });
        }

        const slot = (day.timeSlots || []).find((s) => s.time === time);
        if (!slot || !slot.available) {
            return res.status(400).json({ message: 'Selected time slot is unavailable' });
        }

        const booking = new Booking({
            date,
            time,
            topic,
            company: company || req.user.company,
            name: req.user.name,
            email: req.user.email,
            clientId: req.user._id,
            status: 'confirmed'
        });

        const savedBooking = await booking.save();
        await markSlotBooked(date, time);
        res.status(201).json(savedBooking);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Client: cancel own booking | Editor: update any booking fields/status
router.put('/:id', authenticate, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (req.user.role === 'client') {
            if (String(booking.clientId) !== String(req.user._id)) {
                return res.status(403).json({ message: 'Forbidden for this login' });
            }

            const nextStatus = req.body.status;
            if (nextStatus !== 'cancelled') {
                return res.status(403).json({ message: 'Clients can only cancel their bookings' });
            }

            if (booking.status === 'cancelled') {
                return res.json(booking);
            }

            booking.status = 'cancelled';
            await booking.save();
            await releaseSlot(booking.date, booking.time);
            return res.json(booking);
        }

        if (req.user.role !== 'editor') {
            return res.status(403).json({ message: 'Forbidden for this login' });
        }

        const previousStatus = booking.status;
        const previousTime = booking.time;
        const previousDate = booking.date;

        const allowed = ['status', 'topic', 'notes', 'date', 'time', 'company', 'name'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) booking[key] = req.body[key];
        }

        await booking.save();

        if (previousStatus !== 'cancelled' && booking.status === 'cancelled') {
            await releaseSlot(previousDate, previousTime);
        }

        res.json(booking);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Editor only: hard-delete a booking
router.delete('/:id', authenticate, requireRole('editor'), async (req, res) => {
    try {
        const booking = await Booking.findByIdAndDelete(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.status !== 'cancelled') {
            await releaseSlot(booking.date, booking.time);
        }

        res.json({ message: 'Booking deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
