export class DeleteRecordFiles {
  constructor({ recordRepository, recordImageStorage }) {
    this.recordRepository = recordRepository;
    this.recordImageStorage = recordImageStorage;
  }

  async execute({ userId, recordId }) {
    const files = await this.recordRepository.filesToRemove(userId, recordId);
    await this.#removeStored(files);
    await this.recordRepository.deleteFiles(userId, recordId);
  }

  async #removeStored(files) {
    for (const file of files) {
      await this.recordImageStorage.remove(file.fileUrl);
    }
  }
}
