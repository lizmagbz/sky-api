export class ListRecords {
  constructor({ recordRepository }) {
    this.recordRepository = recordRepository;
  }

  async execute({ userId }) {
    const records = await this.recordRepository.list(userId);
    return records.map((record) => record.toPublic());
  }
}
