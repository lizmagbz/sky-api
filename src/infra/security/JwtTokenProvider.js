import jwt from 'jsonwebtoken';
import { TokenProvider } from '../../domain/security/TokenProvider.js';

export class JwtTokenProvider extends TokenProvider {
  constructor({ secret, expiresIn }) {
    super();
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verify(token) {
    return jwt.verify(token, this.secret);
  }
}
