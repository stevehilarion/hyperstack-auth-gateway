declare module 'rsa-pem-to-jwk' {
  type Jwk = Record<string, any>;
  function pem2jwk(pem: string, options?: { use?: string; kid?: string; alg?: string }, kind?: 'public' | 'private'): Jwk;
  export = pem2jwk;
}
