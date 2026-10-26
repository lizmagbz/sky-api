import { readPositiveId } from '../readPositiveId.js';

export class RecordController {
  constructor({ listRecords, createRecord, updateRecord, deleteRecord }) {
    this.listRecords = listRecords;
    this.createRecord = createRecord;
    this.updateRecord = updateRecord;
    this.deleteRecord = deleteRecord;
  }

  list = async (req, res) => {
    const records = await this.listRecords.execute({ userId: req.userId });
    res.status(200).json(records);
  };

  create = async (req, res) => {
    const created = await this.createRecord.execute({
      userId: req.userId,
      input: req.body,
    });
    res.status(201).json(created);
  };

  update = async (req, res) => {
    const record = await this.updateRecord.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
      input: req.body,
    });
    res.status(200).json(record);
  };

  remove = async (req, res) => {
    await this.deleteRecord.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
    });
    res.status(204).send();
  };
}
