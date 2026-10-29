const request = require('supertest');
const { app } = require('../server');

async function registerClient(overrides = {}) {
    const response = await request(app)
        .post('/api/auth/client/register')
        .send({
            name: 'Ada Client',
            email: 'ada.client@example.com',
            password: 'password123',
            company: 'Ada Co',
            ...overrides
        });
    return response;
}

async function registerEditor(overrides = {}) {
    const response = await request(app)
        .post('/api/auth/editor/register')
        .send({
            name: 'Ed Editor',
            email: 'ed.editor@example.com',
            password: 'password123',
            inviteCode: process.env.EDITOR_INVITE_CODE,
            ...overrides
        });
    return response;
}

describe('Dedicated client and editor login workflows', () => {
    test('client can register and log in on the client portal only', async () => {
        const registered = await registerClient();
        expect(registered.statusCode).toBe(201);
        expect(registered.body.user.role).toBe('client');
        expect(registered.body.token).toBeTruthy();

        const clientLogin = await request(app)
            .post('/api/auth/client/login')
            .send({ email: 'ada.client@example.com', password: 'password123' });
        expect(clientLogin.statusCode).toBe(200);
        expect(clientLogin.body.user.role).toBe('client');

        const editorPortal = await request(app)
            .post('/api/auth/editor/login')
            .send({ email: 'ada.client@example.com', password: 'password123' });
        expect(editorPortal.statusCode).toBe(403);
        expect(editorPortal.body.message).toMatch(/client login/i);
    });

    test('editor can bootstrap, then later editors require invite code', async () => {
        const first = await request(app)
            .post('/api/auth/editor/register')
            .send({
                name: 'First Editor',
                email: 'first.editor@example.com',
                password: 'password123'
            });
        expect(first.statusCode).toBe(201);
        expect(first.body.user.role).toBe('editor');

        const blocked = await request(app)
            .post('/api/auth/editor/register')
            .send({
                name: 'Second Editor',
                email: 'second.editor@example.com',
                password: 'password123'
            });
        expect(blocked.statusCode).toBe(403);

        const second = await registerEditor({
            email: 'second.editor@example.com',
            name: 'Second Editor'
        });
        expect(second.statusCode).toBe(201);

        const clientPortal = await request(app)
            .post('/api/auth/client/login')
            .send({ email: 'first.editor@example.com', password: 'password123' });
        expect(clientPortal.statusCode).toBe(403);
        expect(clientPortal.body.message).toMatch(/editor login/i);
    });

    test('end-to-end: editor sets availability, client books, each stays in their lane', async () => {
        const clientRes = await registerClient();
        const editorRes = await registerEditor();
        const clientToken = clientRes.body.token;
        const editorToken = editorRes.body.token;
        const date = '2025-06-15';

        const clientCannotWriteAvailability = await request(app)
            .put(`/api/availability/${date}`)
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                timeSlots: [{ time: '10:00', available: true }],
                isFullyBooked: false,
                isUnavailable: false
            });
        expect(clientCannotWriteAvailability.statusCode).toBe(403);

        const setAvailability = await request(app)
            .put(`/api/availability/${date}`)
            .set('Authorization', `Bearer ${editorToken}`)
            .send({
                timeSlots: [
                    { time: '10:00', available: true },
                    { time: '11:00', available: true }
                ],
                isFullyBooked: false,
                isUnavailable: false
            });
        expect(setAvailability.statusCode).toBe(200);
        expect(setAvailability.body.timeSlots).toHaveLength(2);

        const openSlots = await request(app).get(`/api/availability/${date}`);
        expect(openSlots.statusCode).toBe(200);

        const booking = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ date, time: '10:00', topic: 'Website consultation' });
        expect(booking.statusCode).toBe(201);
        expect(booking.body.email).toBe('ada.client@example.com');
        expect(booking.body.clientId).toBe(clientRes.body.user.id);

        const slotTaken = await request(app).get(`/api/availability/${date}`);
        const ten = slotTaken.body.timeSlots.find((s) => s.time === '10:00');
        expect(ten.available).toBe(false);

        const myBookings = await request(app)
            .get('/api/bookings/me')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(myBookings.statusCode).toBe(200);
        expect(myBookings.body).toHaveLength(1);

        const clientCannotListAll = await request(app)
            .get('/api/bookings')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(clientCannotListAll.statusCode).toBe(403);

        const editorList = await request(app)
            .get('/api/bookings')
            .set('Authorization', `Bearer ${editorToken}`);
        expect(editorList.statusCode).toBe(200);
        expect(editorList.body).toHaveLength(1);

        const editorCannotUseClientMe = await request(app)
            .get('/api/bookings/me')
            .set('Authorization', `Bearer ${editorToken}`);
        expect(editorCannotUseClientMe.statusCode).toBe(403);

        const cancel = await request(app)
            .put(`/api/bookings/${booking.body._id}`)
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ status: 'cancelled' });
        expect(cancel.statusCode).toBe(200);
        expect(cancel.body.status).toBe('cancelled');

        const freed = await request(app).get(`/api/availability/${date}`);
        expect(freed.body.timeSlots.find((s) => s.time === '10:00').available).toBe(true);

        const clients = await request(app)
            .get('/api/auth/clients')
            .set('Authorization', `Bearer ${editorToken}`);
        expect(clients.statusCode).toBe(200);
        expect(clients.body.some((c) => c.email === 'ada.client@example.com')).toBe(true);

        const clientsBlocked = await request(app)
            .get('/api/auth/clients')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(clientsBlocked.statusCode).toBe(403);
    });

    test('second client cannot read or cancel another client booking', async () => {
        const a = await registerClient({ email: 'a@example.com', name: 'Client A' });
        const b = await registerClient({ email: 'b@example.com', name: 'Client B' });
        const editor = await registerEditor();

        await request(app)
            .put('/api/availability/2025-07-01')
            .set('Authorization', `Bearer ${editor.body.token}`)
            .send({
                timeSlots: [{ time: '09:00', available: true }],
                isFullyBooked: false,
                isUnavailable: false
            });

        const booking = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${a.body.token}`)
            .send({ date: '2025-07-01', time: '09:00', topic: 'Private topic' });

        const peek = await request(app)
            .get(`/api/bookings/${booking.body._id}`)
            .set('Authorization', `Bearer ${b.body.token}`);
        expect(peek.statusCode).toBe(403);

        const cancel = await request(app)
            .put(`/api/bookings/${booking.body._id}`)
            .set('Authorization', `Bearer ${b.body.token}`)
            .send({ status: 'cancelled' });
        expect(cancel.statusCode).toBe(403);
    });
});
