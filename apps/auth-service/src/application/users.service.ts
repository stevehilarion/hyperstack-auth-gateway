import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/repositories/users.repository';
import { PasswordService } from '../infrastructure/security/password.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly password: PasswordService,
  ) {}

  async register(email: string, name: string, password: string) {
    const exists = await this.repo.emailExists(email);
    if (exists) throw new BadRequestException('Email already registered');

    const hash = await this.password.hash(password);
    return this.repo.create({
      email,
      name,
      passwordHash: hash,
    });
  }

  async validateCredentials(email: string, passwordPlain: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;

    const ok = await this.password.verify(passwordPlain, user.passwordHash);
    if (!ok) return null;

    return user;
  }
}

