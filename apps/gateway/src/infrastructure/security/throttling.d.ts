import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
export declare const throttlerOptions: ThrottlerModuleOptions;
export declare class DeviceThrottlerGuard extends ThrottlerGuard {
    getTracker(req: Record<string, any>): Promise<string>;
}
//# sourceMappingURL=throttling.d.ts.map