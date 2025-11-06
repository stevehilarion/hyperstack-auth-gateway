import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

async create(data: { email: string; name?: string | null; passwordHash: string }) {
  return this.prisma.user.create({
    data: {
      email: data.email,
      name: data.name ?? null,
      passwordHash: data.passwordHash,
    },
  });
}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  emailExists(email: string): Promise<boolean> {
    return this.prisma.user.count({ where: { email } }).then((c) => c > 0);
  }
}
