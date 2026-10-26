export class Record {
  constructor({
    id,
    userId,
    topicId,
    schoolId,
    unionId,
    title,
    description,
    eventDate,
    eventEndDate,
    peopleCount,
    authorName,
    imageUrl,
    createdAt,
    updatedAt,
    school,
    union,
    topic,
    files,
  }) {
    this.id = id;
    this.userId = userId;
    this.topicId = topicId;
    this.schoolId = schoolId;
    this.unionId = unionId;
    this.title = title;
    this.description = description;
    this.eventDate = eventDate;
    this.eventEndDate = eventEndDate;
    this.peopleCount = peopleCount;
    this.authorName = authorName;
    this.imageUrl = imageUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.school = school;
    this.union = union;
    this.topic = topic;
    this.files = files;
  }

  toPublic() {
    return {
      id: this.id,
      user_id: this.userId,
      topic_id: this.topicId,
      school_id: this.schoolId,
      union_id: this.unionId,
      title: this.title,
      description: this.description,
      event_date: this.eventDate,
      event_end_date: this.eventEndDate,
      people_count: this.peopleCount,
      author_name: this.authorName,
      image_url: this.imageUrl,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      school: this.school,
      unions: this.union,
      topics: this.topic,
      record_files: this.files.map((file) => file.toPublic()),
    };
  }
}
