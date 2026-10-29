require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        auth: {
            clientLogin: '/api/auth/client/login',
            editorLogin: '/api/auth/editor/login'
        }
    });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/bookings', require('./routes/bookings'));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

async function connectDatabase(uri = process.env.MONGODB_URI) {
    if (!uri) {
        throw new Error('MONGODB_URI is required');
    }
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
}

async function startServer() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required');
    }

    await connectDatabase();
    console.log('Connected to MongoDB');

    const PORT = process.env.PORT || 5002;
    return app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch((err) => {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    });
}

module.exports = { app, connectDatabase, startServer };
