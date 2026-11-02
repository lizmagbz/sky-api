export class DeleteScheduleEvent {
  constructor({ scheduleEventRepository }) {
    this.scheduleEventRepository = scheduleEventRepository;
  }

  async execute({ userId, eventId }) {
    await this.scheduleEventRepository.remove(userId, eventId);
  }
}
