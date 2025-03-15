const request = require('supertest');
const app = require('../server');

describe('Bookings API', () => {
    let bookingId;

    test('Create a new booking', async () => {
        const response = await request(app)
            .post('/api/bookings')
            .send({
                date: "2025-03-20",
                time: "10:00",
                name: "Test User",
                email: "test@example.com",
                topic: "Test Consultation"
            });
        expect(response.statusCode).toBe(201);
        bookingId = response.body._id;
    });

    test('Get all bookings', async () => {
        const response = await request(app)
            .get('/api/bookings');
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBeTruthy();
    });

    test('Update a booking', async () => {
        const response = await request(app)
            .put(`/api/bookings/${bookingId}`)
            .send({ status: 'cancelled' });
        expect(response.statusCode).toBe(200);
    });

    test('Delete a booking', async () => {
        const response = await request(app)
            .delete(`/api/bookings/${bookingId}`);
        expect(response.statusCode).toBe(200);
    });
});