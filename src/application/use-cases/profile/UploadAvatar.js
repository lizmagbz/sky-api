import { AppError } from '../../../domain/errors/AppError.js';

export class UploadAvatar {
  constructor({ profileRepository, avatarStorage }) {
    this.profileRepository = profileRepository;
    this.avatarStorage = avatarStorage;
  }

  async execute({ userId, bytes, contentType }) {
    this.#assertImage(bytes, contentType);
    await this.#ensureProfile(userId);
    const avatarUrl = await this.avatarStorage.save({ userId, bytes });
    await this.profileRepository.saveAvatarUrl(userId, avatarUrl);
    return { avatar_url: avatarUrl };
  }

  #assertImage(bytes, contentType) {
    if (!bytes?.length) throw new AppError('Imagem obrigatória', 400);
    if (this.#isJpeg(contentType)) return;
    throw new AppError('A imagem deve ser JPEG', 400);
  }

  #isJpeg(contentType) {
    if (!contentType) return false;
    if (contentType === 'image/jpg') return true;
    return contentType.startsWith('image/jpeg');
  }

  async #ensureProfile(userId) {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Usuário não encontrado', 404);
  }
}
