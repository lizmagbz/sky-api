export class RecordImageStorage {
  assertReady() {
    throw new Error('RecordImageStorage.assertReady não implementado');
  }

  async save(_image) {
    throw new Error('RecordImageStorage.save não implementado');
  }

  async remove(_fileUrl) {
    throw new Error('RecordImageStorage.remove não implementado');
  }

  async removeOwned(_userId, _fileUrls) {
    throw new Error('RecordImageStorage.removeOwned não implementado');
  }
}
