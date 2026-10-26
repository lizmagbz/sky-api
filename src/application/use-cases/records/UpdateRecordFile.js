export class UpdateRecordFile {
  constructor({ recordRepository }) {
    this.recordRepository = recordRepository;
  }

  async execute({ userId, recordId, fileId, frame }) {
    const file = await this.recordRepository.updateFile(userId, recordId, fileId, {
      isCover: frame.isCover,
      focusX: frame.focusX,
      focusY: frame.focusY,
      focusScale: frame.focusScale ?? null,
    });
    return file.toPublic();
  }
}
