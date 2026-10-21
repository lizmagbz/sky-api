import { AppError } from '../../../domain/errors/AppError.js';

export class RegisterUser {
  constructor({ userRepository, authGateway }) {
    this.userRepository = userRepository;
    this.authGateway = authGateway;
  }

  async execute({ name, email, password }) {
    const account = await this.authGateway.signUp({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    const user = await this.#findUser(account.userId);
    return user.toPublic();
  }

  async #findUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('Falha ao criar usuário', 500);
    return user;
  }
}
