import { AppError } from '../../../domain/errors/AppError.js';

export class ReauthenticateUser {
  constructor({ userRepository, authGateway }) {
    this.userRepository = userRepository;
    this.authGateway = authGateway;
  }

  async execute({ userId, password }) {
    const user = await this.#findUser(userId);
    await this.authGateway.signIn({
      email: user.email.trim().toLowerCase(),
      password,
    });
  }

  async #findUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return user;
  }
}
