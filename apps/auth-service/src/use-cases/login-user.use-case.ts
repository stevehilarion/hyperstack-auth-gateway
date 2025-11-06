import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/repositories/users.repository';
import { PasswordService } from '../infrastructure/security/password.service';
import { Email } from '../domain/value-objects/email.vo';
import { User } from '../domain/entities/user.entity';

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  async execute(input: { email: string; password: string }): Promise<User> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      throw new BadRequestException('Invalid email format');
    }

    const u = await this.repo.findByEmail(email.value);
    if (!u) throw new UnauthorizedException('Invalid credentials');

    const ok = await this.passwords.verify(input.password, u.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return User.create({ id: u.id, email, name: u.name ?? null });
  }
}
