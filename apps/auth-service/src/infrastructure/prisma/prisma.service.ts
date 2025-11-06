import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 300;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private isReady = false;

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async connectWithRetry(): Promise<void> {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        await this.$connect();
        this.isReady = true;
        return;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) throw err;
        await this.sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.isReady = false;
  }

  isConnected(): boolean {
    return this.isReady;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
