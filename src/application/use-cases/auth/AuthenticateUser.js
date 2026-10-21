import { AppError } from '../../../domain/errors/AppError.js';

export class AuthenticateUser {
  constructor({ userRepository, authGateway }) {
    this.userRepository = userRepository;
    this.authGateway = authGateway;
  }

  async execute({ email, password }) {
    const session = await this.authGateway.signIn({
      email: email.trim().toLowerCase(),
      password,
    });
    const user = await this.#findUser(session.userId);

    return {
      accessToken: session.accessToken,
      user: user.toPublic(),
    };
  }

  async #findUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }
}
