const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, requireRole, signToken } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Try again later.' }
});

const registerValidators = [
    body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('company').optional().trim().isLength({ max: 120 })
];

function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: 'Validation failed', errors: errors.array() });
        return false;
    }
    return true;
}

async function registerUser({ name, email, password, role, company }) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        const error = new Error('Email already registered');
        error.status = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        company
    });
}

async function loginWithRole(email, password, expectedRole) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        const error = new Error('Invalid credentials');
        error.status = 401;
        throw error;
    }

    if (user.role !== expectedRole) {
        const error = new Error(`Use the ${user.role} login for this account`);
        error.status = 403;
        throw error;
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        const error = new Error('Invalid credentials');
        error.status = 401;
        throw error;
    }

    return user;
}

// Client-dedicated registration
router.post('/client/register', registerValidators, async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const user = await registerUser({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: 'client',
            company: req.body.company
        });
        const token = signToken(user);
        res.status(201).json({ token, user: user.toSafeObject() });
    } catch (err) {
        res.status(err.status || 400).json({ message: err.message });
    }
});

// Client-dedicated login — rejects editor accounts
router.post(
    '/client/login',
    loginLimiter,
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    async (req, res) => {
        if (!handleValidation(req, res)) return;

        try {
            const user = await loginWithRole(req.body.email, req.body.password, 'client');
            const token = signToken(user);
            res.json({ token, user: user.toSafeObject() });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    }
);

// Editor registration — requires EDITOR_INVITE_CODE (or bootstrap when none exist)
router.post('/editor/register', registerValidators, async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
        const editorCount = await User.countDocuments({ role: 'editor' });
        const inviteCode = process.env.EDITOR_INVITE_CODE;
        const providedCode = req.body.inviteCode;

        if (editorCount > 0) {
            if (!inviteCode || providedCode !== inviteCode) {
                return res.status(403).json({ message: 'Valid editor invite code required' });
            }
        }

        const user = await registerUser({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: 'editor'
        });
        const token = signToken(user);
        res.status(201).json({ token, user: user.toSafeObject() });
    } catch (err) {
        res.status(err.status || 400).json({ message: err.message });
    }
});

// Editor-dedicated login — rejects client accounts
router.post(
    '/editor/login',
    loginLimiter,
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    async (req, res) => {
        if (!handleValidation(req, res)) return;

        try {
            const user = await loginWithRole(req.body.email, req.body.password, 'editor');
            const token = signToken(user);
            res.json({ token, user: user.toSafeObject() });
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    }
);

// Current session for whichever dedicated login issued the token
router.get('/me', authenticate, async (req, res) => {
    res.json({ user: req.user.toSafeObject ? req.user.toSafeObject() : {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        company: req.user.company || undefined,
        createdAt: req.user.createdAt
    }});
});

// Editor-only: list clients (for booking support)
router.get('/clients', authenticate, requireRole('editor'), async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' }).select('-password').sort({ createdAt: -1 });
        res.json(clients.map((c) => ({
            id: c._id,
            name: c.name,
            email: c.email,
            company: c.company || undefined,
            createdAt: c.createdAt
        })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
