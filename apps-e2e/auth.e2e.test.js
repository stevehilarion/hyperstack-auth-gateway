const axios = require('axios');

const API = 'http://localhost:3000/api/auth';
const deviceId = 'e2e-device';
const email = `e2e_${Date.now()}@test.local`;
const password = '12345678';

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const { data } = await axios.get(`${API}/health`, { timeout: 2000 });
      if (data && data.ok === true) return;
    } catch (_) { /* ignore */ }
    if (Date.now() - start > timeoutMs) break;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('health never became OK');
}

describe('Auth E2E (gateway)', () => {
  let accessToken;
  let refreshToken;

  beforeAll(async () => {
    await waitForHealth();

    // intenta registrar; si ya está, ignora 400/409
    try {
      await axios.post(`${API}/register`,
        { email, password, name: 'E2E' },
        { headers: { 'content-type': 'application/json', 'x-device-id': deviceId } }
      );
    } catch (err) {
      const status = err?.response?.status;
      if (![400, 409].includes(status)) throw err;
    }
  }, 30000);

  it('GET /api/auth/health -> ok:true', async () => {
    const { data } = await axios.get(`${API}/health`);
    expect(data.ok).toBe(true);
  });

  it('POST /api/auth/login -> 201 + tokens (previo register si hace falta)', async () => {
    const { data, status } = await axios.post(`${API}/login`,
      { email, password },
      { headers: { 'content-type': 'application/json', 'x-device-id': deviceId } }
    );
    expect(status).toBe(201);
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;

    // sanity: /me funciona
    const me = await axios.get(`${API}/me`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    expect(me.status).toBe(200);
    expect(me.data.email).toBe(email);
  });

  it('POST /api/auth/refresh -> 200 + nuevo par de tokens', async () => {
    // 1er intento
    let r = await axios.post(`${API}/refresh`,
      { refreshToken },
      { headers: { 'content-type': 'application/json', 'x-device-id': deviceId } }
    );
    let data = r.data;
    expect(r.status).toBe(200);
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');

    // si el access sale igual (mismo segundo/iat), reintenta tras 1.2s
    if (data.accessToken === accessToken) {
      await new Promise(r => setTimeout(r, 1200));
      r = await axios.post(`${API}/refresh`,
        { refreshToken },
        { headers: { 'content-type': 'application/json', 'x-device-id': deviceId } }
      );
      data = r.data;
      expect(r.status).toBe(200);
      expect(typeof data.accessToken).toBe('string');
      expect(typeof data.refreshToken).toBe('string');
    }

    expect(data.accessToken).not.toBe(accessToken);
    // refresh puede rotar o no según política; no lo forzamos:
    // expect(data.refreshToken).not.toBe(refreshToken);  // opcional si siempre rotas

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('POST /api/auth/logout -> 200/201 ok:true y el refresh deja de servir', async () => {
    const out = await axios.post(`${API}/logout`,
      { refreshToken },
      { headers: { 'content-type': 'application/json' } }
    );
    // tu API devuelve 201; acepta 200 o 201
    expect([200, 201]).toContain(out.status);
    expect(out.data.ok).toBe(true);

    // el mismo refresh debe fallar
    await expect(
      axios.post(`${API}/refresh`,
        { refreshToken },
        { headers: { 'content-type': 'application/json', 'x-device-id': deviceId } }
      )
    ).rejects.toHaveProperty('response.status', 401);
  });
});
