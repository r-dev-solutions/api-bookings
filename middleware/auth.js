const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

async function authenticate(req, res, next) {
    try {
        const token = getTokenFromHeader(req);
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ message: 'Auth is not configured' });
        }

        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (decoded.role && decoded.role !== user.role) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden for this login' });
        }
        next();
    };
}

function signToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

module.exports = {
    authenticate,
    requireRole,
    signToken
};
