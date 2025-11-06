import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    { ttl: 60_000, limit: 60 },
  ],
};

@Injectable()
export class DeviceThrottlerGuard extends ThrottlerGuard {
  override async getTracker(req: Record<string, any>): Promise<string> {
    const device =
      (req?.headers?.['x-device-id']?.toString() ?? '').slice(0, 64) || 'no-device';
    const fwd = req?.headers?.['x-forwarded-for']?.toString() ?? '';
    const ip = fwd.split(',')[0]?.trim() || req?.socket?.remoteAddress || 'unknown';
    return `${device}:${ip}`;
  }
}
