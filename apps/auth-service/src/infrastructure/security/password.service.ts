import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const DEFAULT_COST = Number(process.env.BCRYPT_COST || 10);

@Injectable()
export class PasswordService {
  private readonly cost = DEFAULT_COST;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  async verify(plain: string, digest: string): Promise<boolean> {
    return bcrypt.compare(plain, digest);
  }
}
