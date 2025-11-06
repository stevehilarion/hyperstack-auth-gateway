import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createPublicKey } from 'crypto';

function resolveKeyFile(p: string) {
  let abs = path.resolve(process.cwd(), p);
  if (fs.existsSync(abs)) return abs;
  abs = path.resolve(__dirname, '../../..', p);
  if (fs.existsSync(abs)) return abs;
  throw new Error(`Key file not found: ${p}`);
}

@Controller('auth/.well-known')
export class JwksController {
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300') // cache 5 min
  jwks(@Res({ passthrough: true }) res: Response) {
    const kid = process.env.JWT_KID || 'dev-key-1';
    const pubPath = resolveKeyFile(process.env.JWT_PUBLIC_KEY_FILE || 'keys/public.pem');
    const pem = fs.readFileSync(pubPath);
    const keyObj = createPublicKey(pem);
    const jwk = keyObj.export({ format: 'jwk' }) as any;
    jwk.use = 'sig';
    jwk.alg = 'RS256';
    jwk.kid = kid;

    const payload = { keys: [jwk] };

    const body = JSON.stringify(payload);
    const weakEtag = `W/"${Buffer.byteLength(body)}-${Buffer.from(String(body.length)).toString('base64')}"`;
    res.setHeader('ETag', weakEtag);
    const inm = (res.req?.headers?.['if-none-match'] ?? '').toString();
    if (inm && inm === weakEtag) {
      res.status(304);
      return;
    }

    return payload;
  }
}
