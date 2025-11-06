import { Body, Controller, Headers, HttpCode, Post, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';
import { IsUUID } from 'class-validator';

class RevokeSessionDto {
  @IsUUID('4')
  sid!: string;
}

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly proxy: AuthProxyService) {}

  @Get()
  async list(
    @Headers('authorization') auth: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { data, headers, status } = await this.proxy.listSessions(auth);
    forwardRateHeaders(headers, res);
    if (req.headers['x-request-id']) res.setHeader('x-request-id', String(req.headers['x-request-id']));
    res.status(status).json(data ?? {});
  }

  @Post('revoke')
  @HttpCode(200)
  async revoke(
    @Body() body: RevokeSessionDto,
    @Headers('authorization') auth: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { data, headers, status } = await this.proxy.revokeSession(body.sid, auth);
    forwardRateHeaders(headers, res);
    if (req.headers['x-request-id']) res.setHeader('x-request-id', String(req.headers['x-request-id']));
    res.status(status).json(data ?? {});
  }
}

function forwardRateHeaders(h: Record<string, string>, res: Response) {
  const map = ['x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','retry-after'];
  for (const k of map) if (h[k] !== undefined) res.setHeader(k, h[k]);
}
