import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../infrastructure/security/current-user.decorator';

@Controller('api')
export class WhoAmIController {
  @Get('whoami')
  whoAmI(@CurrentUser() user: any) {
    return { user };
  }
}
