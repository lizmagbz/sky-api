export class ListGoals {
  constructor({ goalRepository }) {
    this.goalRepository = goalRepository;
  }

  async execute({ userId, year }) {
    const goals = await this.goalRepository.listForYear(userId, year);
    return goals.map((goal) => goal.toPublic());
  }
}
