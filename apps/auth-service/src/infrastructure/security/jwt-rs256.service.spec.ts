import 'reflect-metadata';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

describe('RS256 sign/verify (puro)', () => {
  const ISS = 'https://auth.example.test';
  const AUD = 'hyperstack-api';

  let privateKey: string;
  let publicKey: string;

  beforeAll(() => {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    // @ts-ignore
    privateKey = priv;
    // @ts-ignore
    publicKey = pub;
  });

  it('firma y verifica con RS256', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'u@u.test' },
      privateKey,
      { algorithm: 'RS256', audience: AUD, issuer: ISS, expiresIn: '60s', keyid: 'test-key-1' }
    );

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: AUD,
      issuer: ISS,
    }) as any;

    expect(decoded.sub).toBe('user-1');
    expect(decoded.email).toBe('u@u.test');
    expect(decoded.aud).toBe(AUD);
    expect(decoded.iss).toBe(ISS);
  });

  it('falla con otra public key', () => {
    const token = jwt.sign({ sub: 'x' }, privateKey, {
      algorithm: 'RS256', audience: AUD, issuer: ISS, expiresIn: '60s',
    });
    const { publicKey: wrongPub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    expect(() =>
      jwt.verify(token, wrongPub, { algorithms: ['RS256'], audience: AUD, issuer: ISS })
    ).toThrow();
  });

  it('protege contra downgrade de algoritmo', () => {
    const token = jwt.sign({ sub: 'x' }, privateKey, {
      algorithm: 'RS256', audience: AUD, issuer: ISS, expiresIn: '60s',
    });
    expect(() =>
      jwt.verify(token, publicKey, { algorithms: ['HS256'], audience: AUD, issuer: ISS })
    ).toThrow();
  });
});
