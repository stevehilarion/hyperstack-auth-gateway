import { Controller, Get, Post, Body, Headers, UseGuards, HttpCode, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';
import { JwtRs256Guard } from '../../../infrastructure/security/jwt-rs256.guard';

function forwardRateHeaders(h: Record<string,string>, res: Response) {
  const map = ['x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','retry-after'];
  for (const k of map) if (h[k] !== undefined) res.setHeader(k, h[k]);
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly proxy:  AuthProxyService) {}

  @Get('health')
  async health(@Res() res: Response) {
    const { data, headers, status } = await this.proxy.health();
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @HttpCode(201)
  @Post('register')
  async register(
    @Body() body: unknown,
    @Headers('x-device-id') dev: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { data, headers, status } = await this.proxy.register(body, {
      'x-device-id': dev ?? '',
      'user-agent': req.headers['user-agent'] ?? '',
      'x-forwarded-for': req.ip ?? '',
      'x-request-id': req.headers['x-request-id']?.toString() ?? '',
    });
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: unknown,
    @Headers('x-device-id') dev: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { data, headers, status } = await this.proxy.login(body, {
      'x-device-id': dev ?? '',
      'user-agent': req.headers['user-agent'] ?? '',
      'x-forwarded-for': req.ip ?? '',
      'x-request-id': req.headers['x-request-id']?.toString() ?? '',
    });
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Headers('x-device-id') dev: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { data, headers, status } = await this.proxy.refresh(body, {
      'x-device-id': dev ?? '',
      'user-agent': req.headers['user-agent'] ?? '',
      'x-forwarded-for': req.ip ?? '',
      'x-request-id': req.headers['x-request-id']?.toString() ?? '',
    });
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Body() body: unknown, @Res() res: Response) {
    const { data, headers, status } = await this.proxy.logout(body);
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@Headers('authorization') auth: string | undefined, @Res() res: Response) {
    const { data, headers, status } = await this.proxy.logoutAll(auth);
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }

  @UseGuards(JwtRs256Guard)
  @Get('me')
  async me(@Headers('authorization') auth: string | undefined, @Res() res: Response) {
    const { data, headers, status } = await this.proxy.me(auth);
    forwardRateHeaders(headers, res);
    res.status(status).json(data ?? {});
  }
}
