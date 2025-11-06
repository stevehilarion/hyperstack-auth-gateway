declare module 'jwk-to-pem' {
  type JwkAny = Record<string, any>;
  function jwkToPem(jwk: JwkAny): string;
  export = jwkToPem;
}
