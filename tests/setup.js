const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { connectDatabase } = require('../server');

let mongoServer;

beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    process.env.EDITOR_INVITE_CODE = 'editor-invite-test';
    process.env.NODE_ENV = 'test';

    mongoServer = await MongoMemoryServer.create();
    await connectDatabase(mongoServer.getUri());
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});
