export class ListScheduleEvents {
  constructor({ scheduleEventRepository }) {
    this.scheduleEventRepository = scheduleEventRepository;
  }

  async execute({ userId, googleEventId }) {
    const events = await this.scheduleEventRepository.list(userId, googleEventId);
    return events.map((event) => event.toPublic());
  }
}
