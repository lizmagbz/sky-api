export class GoalRepository {
  async listForYear(_userId, _year) {
    throw new Error('GoalRepository.listForYear não implementado');
  }

  async upsert(_userId, _input) {
    throw new Error('GoalRepository.upsert não implementado');
  }

  async progress(_userId, _topicId, _year) {
    throw new Error('GoalRepository.progress não implementado');
  }
}
