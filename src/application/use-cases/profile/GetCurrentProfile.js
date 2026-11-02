import { AppError } from '../../../domain/errors/AppError.js';

export class GetCurrentProfile {
  constructor({ profileRepository }) {
    this.profileRepository = profileRepository;
  }

  async execute({ userId }) {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Usuário não encontrado', 404);
    return profile.toPublic();
  }
}
