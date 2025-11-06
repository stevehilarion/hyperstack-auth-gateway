import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/repositories/users.repository';
import { JwtRs256Service } from '../infrastructure/security/jwt-rs256.service';

@Injectable()
export class GetMeUseCase {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtRs256Service,
  ) {}

  async execute(accessToken: string) {
    if (!accessToken) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: any;
    try {
      payload = this.jwt.verifyAccess(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
