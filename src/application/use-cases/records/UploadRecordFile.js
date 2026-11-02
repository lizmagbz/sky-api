import { AppError } from '../../../domain/errors/AppError.js';
import { recordImageType } from '../../../domain/records/recordImageType.js';

export class UploadRecordFile {
  constructor({ recordRepository, recordImageStorage }) {
    this.recordRepository = recordRepository;
    this.recordImageStorage = recordImageStorage;
  }

  async execute({ userId, recordId, bytes, contentType, isCover, focusX, focusY, focusScale }) {
    const image = this.#image(bytes, contentType);
    const frame = this.#frame({ isCover, focusX, focusY, focusScale });
    await this.recordRepository.assertCanAttachFile(userId, recordId);
    const stored = await this.recordImageStorage.save({
      userId,
      recordId,
      bytes,
      contentType: image.contentType,
      extension: image.extension,
    });
    return this.#persist({ userId, recordId, stored, image, frame });
  }

  async #persist({ userId, recordId, stored, image, frame }) {
    try {
      const file = await this.recordRepository.addFile(userId, recordId, {
        fileUrl: stored.fileUrl,
        fileType: image.contentType,
        ...frame,
      });
      return file.toPublic();
    } catch (error) {
      await this.#discard(stored.fileUrl);
      throw error;
    }
  }

  async #discard(fileUrl) {
    try {
      await this.recordImageStorage.remove(fileUrl);
    } catch (error) {
      console.error(error);
    }
  }

  #image(bytes, contentType) {
    if (!bytes?.length) throw new AppError('Imagem obrigatória', 400);
    const image = recordImageType(contentType);
    if (!image) throw new AppError('A imagem deve ser JPEG, PNG ou WebP', 400);
    return image;
  }

  #frame({ isCover, focusX, focusY, focusScale }) {
    return {
      isCover: isCover === true,
      focusX: this.#axis(focusX),
      focusY: this.#axis(focusY),
      focusScale: this.#scale(focusScale),
    };
  }

  #axis(value) {
    const number = value ?? 0;
    if (number >= -1 && number <= 1) return number;
    throw new AppError('O enquadramento deve ficar entre -1 e 1', 400);
  }

  #scale(value) {
    const number = value ?? 1;
    if (number >= 1 && number <= 3) return number;
    throw new AppError('O zoom da foto deve ficar entre 1 e 3', 400);
  }
}
