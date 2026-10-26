export class TopicController {
  constructor({ listTopics }) {
    this.listTopics = listTopics;
  }

  list = async (_req, res) => {
    const topics = await this.listTopics.execute();
    res.status(200).json(topics);
  };
}
