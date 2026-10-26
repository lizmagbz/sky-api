export class GoalProgress {
  constructor({ topicId, year, recordCount, peopleCount }) {
    this.topicId = topicId;
    this.year = year;
    this.recordCount = recordCount;
    this.peopleCount = peopleCount;
  }

  toPublic() {
    return {
      topic_id: this.topicId,
      year: this.year,
      record_count: this.recordCount,
      people_count: this.peopleCount,
    };
  }
}
