import { IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';

export class RevokeSessionDto {
  @Expose()
  @IsUUID()
  sid!: string;
}
