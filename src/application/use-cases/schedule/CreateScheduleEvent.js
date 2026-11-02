import { assertSchedulePeriod } from '../../../domain/schedule/assertSchedulePeriod.js';

export class CreateScheduleEvent {
  constructor({ scheduleEventRepository }) {
    this.scheduleEventRepository = scheduleEventRepository;
  }

  async execute({ userId, input }) {
    assertSchedulePeriod(input.startAt, input.endAt);
    const event = await this.scheduleEventRepository.create(userId, input);
    return event.toPublic();
  }
}
