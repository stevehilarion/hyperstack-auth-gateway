import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersRepository } from '../infrastructure/repositories/users.repository';
import { PasswordService } from '../infrastructure/security/password.service';
import { Email } from '../domain/value-objects/email.vo';
import { User } from '../domain/entities/user.entity';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly repo: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  async execute(input: { email: string; name?: string; password: string }): Promise<User> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      throw new BadRequestException('Invalid email format');
    }

    const exists = await this.repo.emailExists(email.value);
    if (exists) throw new BadRequestException('Email already registered');

    const hash = await this.passwords.hash(input.password);

    const created = await this.repo.create({
      email: email.value,
      name: input.name ?? null,
      passwordHash: hash,
    });

    return User.create({ id: created.id, email, name: created.name ?? null });
  }
}
