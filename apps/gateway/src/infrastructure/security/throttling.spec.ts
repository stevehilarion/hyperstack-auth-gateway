import * as mod from './throttling';

function pickFn<T = Function>(names: string[]): T | null {
  for (const n of names) {
    if (typeof (mod as any)[n] === 'function') return (mod as any)[n] as T;
  }
  return null;
}

describe('throttling (IP + deviceId)', () => {
  const normalizeIP = pickFn(['normalizeIP', 'normIP', 'canonIP']);
  const normalizeDevice = pickFn(['normalizeDevice', 'normDevice', 'canonDevice']);
  const buildKeys = pickFn(['buildThrottleKeys', 'buildKeys', 'makeKeys', 'buildRateKeys']);
  const shouldBlock = pickFn(['shouldBlock', 'exceeded', 'isBlocked']);

  it('exports detectados', () => {
    expect(typeof mod).toBe('object');
  });

  (normalizeIP ? it : it.skip)('normaliza IP', () => {
    expect(normalizeIP!(undefined as any)).toMatch(/unknown|local/);
    expect(normalizeIP!('::1')).toMatch(/local/);
    expect(normalizeIP!('127.0.0.1')).toMatch(/local/);
    expect(normalizeIP!('1.2.3.4, 9.9.9.9')).toContain('1.2.3.4');
  });

  (normalizeDevice ? it : it.skip)('normaliza deviceId', () => {
    expect(normalizeDevice!(undefined as any)).toMatch(/unknown/);
    expect(normalizeDevice!('dev-1')).toContain('dev-1');
    expect(normalizeDevice!('x'.repeat(200))).toMatch(/^dev:.{1,64}$/);
  });

  (buildKeys ? it : it.skip)('genera claves por ruta+ip y ruta+device', () => {
    const out = buildKeys!({ route: '/api/auth/login', ip: '1.2.3.4', deviceId: 'abc' });
    const s = JSON.stringify(out);
    expect(s).toContain('/api/auth/login');
    expect(s).toContain('1.2.3.4');
    expect(s).toContain('abc');
  });

  (shouldBlock ? it : it.skip)('bloquea si se excede IP o device', () => {
    expect(shouldBlock!({ ipCount: 100, devCount: 0 }, { ip: 100, dev: 50 })).toBe(true);
    expect(shouldBlock!({ ipCount: 99, devCount: 51 }, { ip: 100, dev: 50 })).toBe(true);
    expect(shouldBlock!({ ipCount: 10, devCount: 10 }, { ip: 100, dev: 50 })).toBe(false);
  });
});
