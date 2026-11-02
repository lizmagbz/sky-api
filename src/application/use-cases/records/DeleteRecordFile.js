export class DeleteRecordFile {
  constructor({ recordRepository, recordImageStorage }) {
    this.recordRepository = recordRepository;
    this.recordImageStorage = recordImageStorage;
  }

  async execute({ userId, recordId, fileId }) {
    const file = await this.recordRepository.fileToRemove(userId, recordId, fileId);
    await this.recordImageStorage.remove(file.fileUrl);
    await this.recordRepository.deleteFile(userId, recordId, fileId);
  }
}
