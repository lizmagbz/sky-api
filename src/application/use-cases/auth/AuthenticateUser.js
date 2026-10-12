import { AppError } from '../../../domain/errors/AppError.js';

export class AuthenticateUser {
  constructor({ userRepository, passwordHasher, tokenProvider }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
  }

  async execute({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const accessToken = this.tokenProvider.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: user.toPublic(),
    };
  }
}
