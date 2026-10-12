import { AppError } from '../../../domain/errors/AppError.js';

export class GetAuthenticatedUser {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ userId }) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    return user.toPublic();
  }
}
