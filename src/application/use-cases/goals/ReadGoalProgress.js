export class ReadGoalProgress {
  constructor({ goalRepository }) {
    this.goalRepository = goalRepository;
  }

  async execute({ userId, topicId, year }) {
    const progress = await this.goalRepository.progress(userId, topicId, year);
    return progress.toPublic();
  }
}
