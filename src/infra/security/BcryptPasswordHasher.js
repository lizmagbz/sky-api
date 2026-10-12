import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../domain/security/PasswordHasher.js';

export class BcryptPasswordHasher extends PasswordHasher {
  constructor(rounds = 10) {
    super();
    this.rounds = rounds;
  }

  hash(plainText) {
    return bcrypt.hash(plainText, this.rounds);
  }

  compare(plainText, passwordHash) {
    return bcrypt.compare(plainText, passwordHash);
  }
}
