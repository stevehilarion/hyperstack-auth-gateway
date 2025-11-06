import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationShutdown() {
    await this.prisma.$disconnect();
  }
}
