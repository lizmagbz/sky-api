import { readGoogleEventId, readScheduleEventId } from '../readScheduleQuery.js';

export class ScheduleEventController {
  constructor({ listScheduleEvents, createScheduleEvent, updateScheduleEvent, deleteScheduleEvent }) {
    this.listScheduleEvents = listScheduleEvents;
    this.createScheduleEvent = createScheduleEvent;
    this.updateScheduleEvent = updateScheduleEvent;
    this.deleteScheduleEvent = deleteScheduleEvent;
  }

  list = async (req, res) => {
    const events = await this.listScheduleEvents.execute({
      userId: req.userId,
      googleEventId: readGoogleEventId(req.query.googleEventId),
    });
    res.status(200).json(events);
  };

  create = async (req, res) => {
    const event = await this.createScheduleEvent.execute({
      userId: req.userId,
      input: req.body,
    });
    res.status(201).json(event);
  };

  update = async (req, res) => {
    const event = await this.updateScheduleEvent.execute({
      userId: req.userId,
      eventId: readScheduleEventId(req.params.id),
      input: req.body,
    });
    res.status(200).json(event);
  };

  remove = async (req, res) => {
    await this.deleteScheduleEvent.execute({
      userId: req.userId,
      eventId: readScheduleEventId(req.params.id),
    });
    res.status(204).send();
  };
}
