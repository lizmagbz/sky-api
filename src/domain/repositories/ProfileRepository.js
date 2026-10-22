export class ProfileRepository {
  async findByUserId(_userId) {
    throw new Error('ProfileRepository.findByUserId não implementado');
  }

  async save(_userId, _change) {
    throw new Error('ProfileRepository.save não implementado');
  }

  async replaceSchoolLinks(_userId, _links) {
    throw new Error('ProfileRepository.replaceSchoolLinks não implementado');
  }

  async saveAvatarUrl(_userId, _avatarUrl) {
    throw new Error('ProfileRepository.saveAvatarUrl não implementado');
  }
}
