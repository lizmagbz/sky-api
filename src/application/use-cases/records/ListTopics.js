export class ListTopics {
  constructor({ topicRepository }) {
    this.topicRepository = topicRepository;
  }

  async execute() {
    const topics = await this.topicRepository.list();
    return topics.map((topic) => topic.toPublic());
  }
}
