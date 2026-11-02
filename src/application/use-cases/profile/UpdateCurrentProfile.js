import { AppError } from '../../../domain/errors/AppError.js';
import { ProfileUpdate } from '../../../domain/profile/ProfileUpdate.js';

export class UpdateCurrentProfile {
  constructor({ profileRepository, authGateway }) {
    this.profileRepository = profileRepository;
    this.authGateway = authGateway;
  }

  async execute({ userId, accessToken, patch }) {
    const profile = await this.#load(userId);
    const update = new ProfileUpdate({ profile, patch });
    update.assertAllowed();
    await this.profileRepository.save(userId, update.toChange());
    await this.#syncAuth(accessToken, update);
    return (await this.#load(userId)).toPublic();
  }

  async #load(userId) {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Usuário não encontrado', 404);
    return profile;
  }

  async #syncAuth(accessToken, update) {
    const data = update.authData();
    if (Object.keys(data).length === 0) return;
    await this.authGateway.updateUserMetadata({ accessToken, data });
  }
}
