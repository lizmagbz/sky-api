import { AppError } from '../../../domain/errors/AppError.js';

export class ReplaceSchoolLinks {
  constructor({ profileRepository }) {
    this.profileRepository = profileRepository;
  }

  async execute({ userId, deleteLinkIds, schoolIds }) {
    const profile = await this.#load(userId);
    this.#rejectUnionCoordinator(profile, schoolIds);
    await this.profileRepository.replaceSchoolLinks(userId, { deleteLinkIds, schoolIds });
    return (await this.#load(userId)).toPublic();
  }

  async #load(userId) {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Usuário não encontrado', 404);
    return profile;
  }

  #rejectUnionCoordinator(profile, schoolIds) {
    if (!profile.isUnionCoordinator()) return;
    if (schoolIds.length === 0) return;
    throw new AppError('Coordenador de união não possui vínculo com escola', 400);
  }
}
