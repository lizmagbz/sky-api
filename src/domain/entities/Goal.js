export class Goal {
  constructor({ id, topicId, targetCount, year, topicName, updatedAt }) {
    this.id = id;
    this.topicId = topicId;
    this.targetCount = targetCount;
    this.year = year;
    this.topicName = topicName;
    this.updatedAt = updatedAt;
  }

  toPublic() {
    return {
      id: this.id,
      topic_id: this.topicId,
      target_count: this.targetCount,
      year: this.year,
      topics: { name: this.topicName },
      updated_at: this.updatedAt,
    };
  }
}
