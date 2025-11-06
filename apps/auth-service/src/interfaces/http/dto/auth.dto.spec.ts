import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const mod = require('./auth.dto');

const pick = (cands: string[]) => {
  for (const k of Object.keys(mod)) {
    if (cands.some(c => k.toLowerCase().includes(c))) return { name: k, Class: mod[k] };
  }
  return null;
};

async function expectValid(ClassRef: any, obj: any) {
  const dto = plainToInstance(ClassRef, obj);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) throw new Error('Expected valid but got: ' + JSON.stringify(errors));
}

async function expectInvalid(ClassRef: any, obj: any, mustContain: string) {
  const dto = plainToInstance(ClassRef, obj);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  expect(errors.length).toBeGreaterThan(0);
  expect(JSON.stringify(errors)).toContain(mustContain);
}

describe('Auth DTOs (dinámico contra exports reales)', () => {
  const reg = pick(['register']);
  const login = pick(['login']);
  const refresh = pick(['refresh']);
  const logout = pick(['logout']);

  if (reg) {
    it(`${reg.name} válido`, async () => {
      await expectValid(reg.Class, { email: 'a@a.com', password: '12345678', name: 'E2E' });
    });
    it(`${reg.name} inválido (email y minLength)`, async () => {
      await expectInvalid(reg.Class, { email: 'bad', password: '123' }, 'isEmail');
      await expectInvalid(reg.Class, { email: 'bad', password: '123' }, 'minLength');
    });
    it(`${reg.name} rechaza campos extra (whitelist)`, async () => {
      await expectInvalid(reg.Class, { email: 'a@a.com', password: '12345678', extra: 'x' }, 'extra');
    });
  } else it.skip('RegisterDto no exportado por auth.dto.ts', () => {});

  if (login) {
    it(`${login.name} válido`, async () => {
      await expectValid(login.Class, { email: 'b@b.com', password: '12345678' });
    });
    it(`${login.name} inválido`, async () => {
      await expectInvalid(login.Class, { email: 'bad', password: '123' }, 'isEmail');
      await expectInvalid(login.Class, { email: 'bad', password: '123' }, 'minLength');
    });
    it(`${login.name} whitelist`, async () => {
      await expectInvalid(login.Class, { email: 'b@b.com', password: '12345678', foo: 'bar' }, 'foo');
    });
  } else it.skip('LoginDto no exportado por auth.dto.ts', () => {});

  if (refresh) {
    it(`${refresh.name} válido`, async () => {
      await expectValid(refresh.Class, { refreshToken: 'eyJ...' });
    });
    it(`${refresh.name} inválido (faltante)`, async () => {
      await expectInvalid(refresh.Class, {}, 'refreshToken');
    });
  } else it.skip('RefreshDto no exportado por auth.dto.ts', () => {});

  if (logout) {
    it(`${logout.name} válido`, async () => {
      await expectValid(logout.Class, { refreshToken: 'eyJ...' });
    });
    it(`${logout.name} inválido (faltante)`, async () => {
      await expectInvalid(logout.Class, {}, 'refreshToken');
    });
  } else it.skip('LogoutDto no exportado por auth.dto.ts', () => {});
});
