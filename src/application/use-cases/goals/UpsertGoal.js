export class UpsertGoal {
  constructor({ goalRepository }) {
    this.goalRepository = goalRepository;
  }

  async execute({ userId, input }) {
    const goal = await this.goalRepository.upsert(userId, input);
    return goal.toPublic();
  }
}
