export class ListRecordFiles {
  constructor({ recordRepository }) {
    this.recordRepository = recordRepository;
  }

  async execute({ userId, recordId }) {
    const files = await this.recordRepository.listFiles(userId, recordId);
    return files.map((file) => file.toPublic());
  }
}
