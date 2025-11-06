import { SessionsController } from '../../interfaces/http/controllers/sessions.controller';
import { Module } from '@nestjs/common';
import { EnvModule } from '../../config/env/env.module';
import { HealthController } from '../../interfaces/http/controllers/health.controller';
import { AuthController } from '../../interfaces/http/controllers/auth.controller';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { LoggingInterceptor } from '../../infrastructure/logging/logging.interceptor';
import { LoggerService } from '../../infrastructure/logging/logger.service';
import { AuthProxyService } from '../../infrastructure/http/auth-proxy.service';
import { AuthClientService } from '../../infrastructure/http/auth-client.service';
import { JwksService } from '../../infrastructure/security/jwks.service';
import { JwtRs256Guard } from '../../infrastructure/security/jwt-rs256.guard';
import { GlobalJwtGuard } from '../../infrastructure/security/global-auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { throttlerOptions, DeviceThrottlerGuard } from '../../infrastructure/security/throttling';
import { WhoAmIController } from '../../interfaces/http/controllers/whoami.controller';
import { MetricsInterceptor } from '../../observability/metrics.interceptor';
import { ErrorsFilter } from '../../observability/errors.filter';

@Module({
  imports: [
    EnvModule,
    ThrottlerModule.forRoot(throttlerOptions),
  ],
  controllers: [HealthController, AuthController, WhoAmIController, SessionsController],
  providers: [
    LoggerService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_FILTER, useClass: ErrorsFilter },
    AuthClientService,
    AuthProxyService,
    JwksService,
    JwtRs256Guard,

    { provide: APP_GUARD, useClass: DeviceThrottlerGuard },
    { provide: APP_GUARD, useClass: GlobalJwtGuard },
  ],
})
export class BootstrapModule {}
