import { assertEventPeriod } from '../../../domain/records/assertEventPeriod.js';
import { AppError } from '../../../domain/errors/AppError.js';

export class CreateRecord {
  constructor({ recordRepository, userRepository }) {
    this.recordRepository = recordRepository;
    this.userRepository = userRepository;
  }

  async execute({ userId, input }) {
    assertEventPeriod(input.eventDate, input.eventEndDate);
    const authorName = await this.#authorName(userId, input.authorName);
    const id = await this.recordRepository.create(userId, this.#draft(input, authorName));
    return { id };
  }

  #draft(input, authorName) {
    return {
      title: input.title,
      description: input.description,
      eventDate: input.eventDate,
      eventEndDate: input.eventEndDate ?? null,
      peopleCount: input.peopleCount ?? null,
      authorName,
      schoolId: input.schoolId ?? null,
      unionId: input.unionId ?? null,
      topicId: input.topicId,
    };
  }

  async #authorName(userId, authorName) {
    const provided = authorName?.trim();
    if (provided) return provided;
    const user = await this.userRepository.findById(userId);
    const stored = user?.name?.trim();
    if (stored) return stored;
    throw new AppError('Usuário não encontrado', 404);
  }
}
