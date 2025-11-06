import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [
    { ttl: 60_000, limit: 100 }, // default bucket (fallback)
  ],
};

@Injectable()
export class DeviceThrottlerGuard extends ThrottlerGuard {
  override async getTracker(req: any): Promise<string> {
    const device = (req.headers['x-device-id']?.toString() ?? '').slice(0, 64) || 'no-device';
    const ip =
      (req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim()) ||
      (req.socket?.remoteAddress ?? 'unknown');
    return `${device}:${ip}`;
  }
}
