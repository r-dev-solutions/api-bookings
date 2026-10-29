const request = require('supertest');
const { app } = require('../server');

describe('Bookings API auth gates', () => {
    test('unauthenticated booking create is rejected', async () => {
        const response = await request(app)
            .post('/api/bookings')
            .send({
                date: '2025-03-20',
                time: '10:00',
                name: 'Test User',
                email: 'test@example.com',
                topic: 'Test Consultation'
            });
        expect(response.statusCode).toBe(401);
    });

    test('unauthenticated booking list is rejected', async () => {
        const response = await request(app).get('/api/bookings');
        expect(response.statusCode).toBe(401);
    });
});
