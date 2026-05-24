/**
 * Pruebas de registro e inicio de sesión
 * POST /api/users/register
 * GET  /api/users/profile  (verifica autenticación con token Firebase)
 */

// ── Mocks (deben declararse antes de require('../src/app')) ───────────────────

jest.mock('../src/config/firebase', () => ({
  admin: {
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid-test' }),
    }),
  },
  initializeFirebase: jest.fn(),
}));

jest.mock('../src/services/userService', () => ({
  registerUser:          jest.fn(),
  getUserByFirebaseUid:  jest.fn(),
  updateProfile:         jest.fn(),
}));

jest.mock('../src/services/paymentService', () => ({
  createPaymentIntent: jest.fn(),
  setupCard:           jest.fn(),
  listCards:           jest.fn(),
  deleteCard:          jest.fn(),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

const request     = require('supertest');
const app         = require('../src/app');
const userService = require('../src/services/userService');

const VALID_USER = {
  fullName:    'María García',
  email:       'maria@test.com',
  phone:       '3009876543',
  gender:      'female',
  language:    'ES',
  firebaseUid: 'uid-abc-123',
  role:        'passenger',
};

// ── POST /api/users/register ──────────────────────────────────────────────────

describe('POST /api/users/register — Registro de usuario', () => {
  afterEach(() => jest.clearAllMocks());

  test('201 — crea usuario correctamente con datos válidos', async () => {
    userService.registerUser.mockResolvedValue({ _id: 'mongo-id-1', ...VALID_USER });

    const res = await request(app)
      .post('/api/users/register')
      .send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(VALID_USER.email);
    expect(userService.registerUser).toHaveBeenCalledTimes(1);
  });

  test('400 — falla si fullName tiene menos de 3 caracteres', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...VALID_USER, fullName: 'Ab' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — falla con email inválido', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...VALID_USER, email: 'no-es-un-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 — falla si falta firebaseUid', async () => {
    const { firebaseUid, ...payload } = VALID_USER;
    const res = await request(app)
      .post('/api/users/register')
      .send(payload);

    expect(res.status).toBe(400);
  });

  test('400 — falla con género no permitido', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...VALID_USER, gender: 'otro' });

    expect(res.status).toBe(400);
  });

  test('400 — falla si el teléfono tiene menos de 7 dígitos', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...VALID_USER, phone: '123' });

    expect(res.status).toBe(400);
  });

  test('500 — propaga errores del servicio', async () => {
    userService.registerUser.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/users/register')
      .send(VALID_USER);

    expect(res.status).toBe(500);
  });
});

// ── GET /api/users/profile ────────────────────────────────────────────────────

describe('GET /api/users/profile — Inicio de sesión (token Firebase)', () => {
  afterEach(() => jest.clearAllMocks());

  test('200 — retorna perfil con token válido', async () => {
    const mockUser = {
      _id: 'uid-1', fullName: 'María García',
      email: 'maria@test.com', role: 'passenger',
    };
    userService.getUserByFirebaseUid.mockResolvedValue(mockUser);

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('maria@test.com');
    expect(userService.getUserByFirebaseUid).toHaveBeenCalledWith('firebase-uid-test');
  });

  test('401 — sin encabezado de autorización', async () => {
    const res = await request(app).get('/api/users/profile');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('401 — token con formato inválido (sin Bearer)', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'invalid-token-format');

    expect(res.status).toBe(401);
  });

  test('404 — usuario autenticado pero sin registro en base de datos', async () => {
    userService.getUserByFirebaseUid.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
