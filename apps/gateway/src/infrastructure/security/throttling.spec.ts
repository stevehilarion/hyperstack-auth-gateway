import { throttlerOptions, DeviceThrottlerGuard } from './throttling';

describe('throttling (IP + deviceId)', () => {
  it('exports detectados', () => {
    expect(throttlerOptions).toBeDefined();
    expect(Array.isArray(throttlerOptions.throttlers)).toBe(true);
    expect(new DeviceThrottlerGuard()).toBeInstanceOf(DeviceThrottlerGuard);
  });

  it('normaliza IP (x-forwarded-for primero, si no remoteAddress)', async () => {
    const guard = new DeviceThrottlerGuard() as any;

    const req1 = {
      headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
      socket: { remoteAddress: '5.5.5.5' },
    };
    await expect(guard.getTracker(req1)).resolves.toMatch(/^no-device:1\.2\.3\.4$/);

    const req2 = {
      headers: {},
      socket: { remoteAddress: '5.5.5.5' },
    };
    await expect(guard.getTracker(req2)).resolves.toBe('no-device:5.5.5.5');
  });

  it('normaliza deviceId (toString, corte a 64, fallback no-device)', async () => {
    const guard = new DeviceThrottlerGuard() as any;

    const long = 'x'.repeat(200);
    const req1 = {
      headers: { 'x-device-id': long },
      socket: { remoteAddress: '1.1.1.1' },
    };
    const tracker1: string = await guard.getTracker(req1);
    const [device1] = tracker1.split(':');
    expect(device1.length).toBe(64);

    const req2 = {
      headers: { 'x-device-id': 12345 as any },
      socket: { remoteAddress: '1.1.1.1' },
    };
    await expect(guard.getTracker(req2)).resolves.toBe('12345:1.1.1.1');

    const req3 = {
      headers: {},
      socket: { remoteAddress: '1.1.1.1' },
    };
    await expect(guard.getTracker(req3)).resolves.toBe('no-device:1.1.1.1');
  });

  it('compone la clave como "device:ip" (no usa ruta)', async () => {
    const guard = new DeviceThrottlerGuard() as any;
    const req = {
      headers: { 'x-device-id': 'dev-abc', 'x-forwarded-for': '7.7.7.7' },
      socket: { remoteAddress: '0.0.0.0' },
      originalUrl: '/api/x', // no afecta
    };
    await expect(guard.getTracker(req)).resolves.toBe('dev-abc:7.7.7.7');
  });

  it.skip('bloquea si se excede IP o device (esto es de integración)', () => {
  });
});
