import { Global, Module } from '@nestjs/common';
import loadEnvOrDie from './env.loader';
import { EnvService } from './env.service';

@Global()
@Module({
  providers: [
    {
      provide: EnvService,
      useFactory: () => {
        const env = loadEnvOrDie();
        const service = new EnvService(env);
        EnvService.init(env);
        return service;
      },
    },
  ],
  exports: [EnvService],
})
export class EnvModule {}
