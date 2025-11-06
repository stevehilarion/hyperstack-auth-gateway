import {
  Controller, Get, Post, Headers, UnauthorizedException, HttpCode, Body,
} from '@nestjs/common';
import { JwtRs256Service } from '../../../infrastructure/security/jwt-rs256.service';
import { TokenService } from '../../../application/auth/token.service';
import { RevokeSessionDto } from '../dto/sessions.dto';

@Controller('auth')
export class SessionsController {
  constructor(
    private readonly jwt: JwtRs256Service,
    private readonly tokens: TokenService,
  ) {}

  private requireUserId(auth?: string): string {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Missing token');
    try { return this.jwt.verifyAccess(token).sub; }
    catch { throw new UnauthorizedException('Invalid or expired token'); }
  }

  @Get('sessions')
  async list(@Headers('authorization') auth?: string) {
    const userId = this.requireUserId(auth);
    return this.tokens.listSessions(userId);
  }

  @HttpCode(200)
  @Post('sessions/revoke')
  async revoke(
    @Headers('authorization') auth: string | undefined,
    @Body() body: RevokeSessionDto,
  ) {
    const userId = this.requireUserId(auth);
    return this.tokens.revokeSid(userId, body.sid);
  }
}
