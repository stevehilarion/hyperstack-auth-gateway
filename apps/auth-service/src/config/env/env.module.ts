import { Global, Module } from '@nestjs/common';
import { AuthEnvService } from './env.service';

@Global()
@Module({
  providers: [
    {
      provide: AuthEnvService,
      useFactory: () => AuthEnvService.getStatic(),
    },
  ],
  exports: [AuthEnvService],
})
export class AuthEnvModule {}
