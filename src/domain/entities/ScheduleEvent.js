export class ScheduleEvent {
  constructor({
    id,
    userId,
    title,
    description,
    startAt,
    endAt,
    createdAt,
    googleEventId,
    googleCalendarId,
    updatedAt,
    isAllDay,
    audience,
    associationId,
    unionId,
  }) {
    this.id = id;
    this.userId = userId;
    this.title = title;
    this.description = description;
    this.startAt = startAt;
    this.endAt = endAt;
    this.createdAt = createdAt;
    this.googleEventId = googleEventId;
    this.googleCalendarId = googleCalendarId;
    this.updatedAt = updatedAt;
    this.isAllDay = isAllDay;
    this.audience = audience;
    this.associationId = associationId;
    this.unionId = unionId;
  }

  toPublic() {
    return {
      id: this.id,
      user_id: this.userId,
      title: this.title,
      description: this.description,
      start_at: this.startAt,
      end_at: this.endAt,
      created_at: this.createdAt,
      google_event_id: this.googleEventId,
      google_calendar_id: this.googleCalendarId,
      updated_at: this.updatedAt,
      is_all_day: this.isAllDay,
      audience: this.audience,
      association_id: this.associationId,
      union_id: this.unionId,
    };
  }
}
