import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthEnvModule } from '../../config/env/env.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { LoggingInterceptor } from '../../infrastructure/logging/logging.interceptor';
import { LoggerService } from '../../infrastructure/logging/logger.service';

import { AuthHealthController } from '../../interfaces/http/controllers/health.controller';
import { AuthController } from '../../interfaces/http/controllers/auth.controller';
import { SessionsController } from '../../interfaces/http/controllers/sessions.controller';
import { JwksController } from '../../interfaces/http/controllers/jwks.controller';

import { UsersRepository } from '../../infrastructure/repositories/users.repository';
import { PasswordService } from '../../infrastructure/security/password.service';
import { JwtRs256Service } from '../../infrastructure/security/jwt-rs256.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

import { RegisterUserUseCase } from '../../use-cases/register-user.use-case';
import { LoginUserUseCase } from '../../use-cases/login-user.use-case';
import { GetMeUseCase } from '../../use-cases/get-me.use-case';
import { TokenService } from '../../application/auth/token.service';

import { ThrottlerModule } from '@nestjs/throttler';
import { throttlerOptions, DeviceThrottlerGuard } from '../../infrastructure/security/throttling';

@Module({
  imports: [
    AuthEnvModule,
    PrismaModule,
    ThrottlerModule.forRoot(throttlerOptions),
  ],
  controllers: [AuthHealthController, AuthController, SessionsController, JwksController],
  providers: [
    UsersRepository,
    PasswordService,
    JwtRs256Service,
    RedisService,
    TokenService,
    RegisterUserUseCase,
    LoginUserUseCase,
    GetMeUseCase,
    LoggerService,
    { provide: APP_GUARD, useClass: DeviceThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AuthBootstrapModule {}
