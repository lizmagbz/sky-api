export class RecordRepository {
  async list(_userId) {
    throw new Error('RecordRepository.list não implementado');
  }

  async create(_userId, _input) {
    throw new Error('RecordRepository.create não implementado');
  }

  async update(_userId, _recordId, _input) {
    throw new Error('RecordRepository.update não implementado');
  }

  async remove(_userId, _recordId) {
    throw new Error('RecordRepository.remove não implementado');
  }

  async listFiles(_userId, _recordId) {
    throw new Error('RecordRepository.listFiles não implementado');
  }

  async assertCanAttachFile(_userId, _recordId) {
    throw new Error('RecordRepository.assertCanAttachFile não implementado');
  }

  async addFile(_userId, _recordId, _file) {
    throw new Error('RecordRepository.addFile não implementado');
  }

  async updateFile(_userId, _recordId, _fileId, _frame) {
    throw new Error('RecordRepository.updateFile não implementado');
  }

  async filesToRemove(_userId, _recordId) {
    throw new Error('RecordRepository.filesToRemove não implementado');
  }

  async fileToRemove(_userId, _recordId, _fileId) {
    throw new Error('RecordRepository.fileToRemove não implementado');
  }

  async deleteFile(_userId, _recordId, _fileId) {
    throw new Error('RecordRepository.deleteFile não implementado');
  }

  async deleteFiles(_userId, _recordId) {
    throw new Error('RecordRepository.deleteFiles não implementado');
  }
}
