import { assertSchedulePeriod } from '../../../domain/schedule/assertSchedulePeriod.js';

export class UpdateScheduleEvent {
  constructor({ scheduleEventRepository }) {
    this.scheduleEventRepository = scheduleEventRepository;
  }

  async execute({ userId, eventId, input }) {
    this.#assertPeriod(input);
    const event = await this.scheduleEventRepository.update(userId, eventId, input);
    return event.toPublic();
  }

  #assertPeriod(input) {
    if (!input.startAt || !input.endAt) return;
    assertSchedulePeriod(input.startAt, input.endAt);
  }
}
