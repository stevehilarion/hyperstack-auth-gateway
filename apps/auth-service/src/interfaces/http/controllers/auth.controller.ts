import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  HttpCode,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { RegisterUserUseCase } from '../../../use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../../use-cases/login-user.use-case';
import { UsersRepository } from '../../../infrastructure/repositories/users.repository';
import { JwtRs256Service } from '../../../infrastructure/security/jwt-rs256.service';
import { TokenService } from '../../../application/auth/token.service';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from '../dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly usersRepo: UsersRepository,
    private readonly jwt: JwtRs256Service,
    private readonly tokens: TokenService,
  ) {}

  private metaFrom(req: Request) {
    const ua = req.headers['user-agent']?.toString() ?? '';
    const deviceId = req.headers['x-device-id']?.toString() ?? '';
    const ip =
      req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim() ||
      (req.socket?.remoteAddress ?? '');
    return { ua, ip, deviceId };
  }

  private userIdFromAuthHeader(auth?: string) {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: any;
    try {
      payload = this.jwt.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return payload.sub as string;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    const user = await this.registerUser.execute({
      email: body.email,
      password: body.password,
      name: body.name ?? undefined,
    });

    const accessToken = this.jwt.signAccess({ sub: user.id, email: user.email.value });
    const { refresh } = await this.tokens.createInitialRefresh(user.id, this.metaFrom(req));

    return { accessToken, refreshToken: refresh };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const user = await this.loginUser.execute({ email: body.email, password: body.password });
    const accessToken = this.jwt.signAccess({ sub: user.id, email: user.email.value });
    const { refresh } = await this.tokens.createInitialRefresh(user.id, this.metaFrom(req));
    return { accessToken, refreshToken: refresh };
  }

  @Get('me')
  async me(@Headers('authorization') auth?: string) {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: any;
    try {
      payload = this.jwt.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const u = await this.usersRepo.findById(payload.sub);
    if (!u) throw new UnauthorizedException('User not found');

    return { id: u.id, email: u.email, name: u.name ?? null };
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Body() body: RefreshDto, @Req() req: Request) {
    let decoded: any;
    try {
      decoded = this.jwt.verifyRefresh(body.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let rotated;
    try {
      rotated = await this.tokens.rotateRefresh(body.refreshToken, this.metaFrom(req));
    } catch (e: any) {
      const msg = (e?.message || 'Unauthorized').toString();
      throw new UnauthorizedException(msg);
    }
    const { newRefresh } = rotated;

    const u = await this.usersRepo.findById(decoded.sub);
    if (!u) throw new UnauthorizedException('User not found');

    const newAccess = this.jwt.signAccess({ sub: decoded.sub, email: u.email });
    const verified = this.jwt.verifyAccess(newAccess);
    const accessExp = (verified as any).exp;

    return { accessToken: newAccess, accessTokenExp: accessExp, refreshToken: newRefresh, sid: decoded.sid };
  }

  @Post('logout')
  async logout(@Body() body: LogoutDto) {
    try {
      await this.tokens.revokeFamily(body.refreshToken);
      return { ok: true };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  @Post('logout-all')
  async logoutAll(@Headers('authorization') auth?: string) {
    const userId = this.userIdFromAuthHeader(auth);
    const res = await this.tokens.revokeAll(userId);
    return { ok: true, revoked: res.count };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('sessions')
  async sessions(@Headers('authorization') auth?: string) {
    const userId = this.userIdFromAuthHeader(auth);
    const list = await this.tokens.listSessions(userId);
    return list;
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('sessions/revoke')
  async revokeSession(@Headers('authorization') auth?: string, @Body('sid') sid?: string) {
    const userId = this.userIdFromAuthHeader(auth);
    if (!sid || typeof sid !== 'string') {
      throw new UnauthorizedException('Missing sid');
    }
    const res = await this.tokens.revokeSid(userId, sid);
    return { ok: true, revoked: res.revoked };
  }
}
