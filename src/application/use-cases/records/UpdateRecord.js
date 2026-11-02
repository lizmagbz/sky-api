import { assertEventPeriod } from '../../../domain/records/assertEventPeriod.js';

export class UpdateRecord {
  constructor({ recordRepository }) {
    this.recordRepository = recordRepository;
  }

  async execute({ userId, recordId, input }) {
    assertEventPeriod(input.eventDate, input.eventEndDate);
    const record = await this.recordRepository.update(userId, recordId, {
      title: input.title,
      description: input.description,
      eventDate: input.eventDate,
      eventEndDate: input.eventEndDate ?? null,
      peopleCount: input.peopleCount ?? null,
    });
    return record.toPublic();
  }
}
