export class AvatarStorage {
  assertReady() {
    throw new Error('AvatarStorage.assertReady não implementado');
  }

  async save(_avatar) {
    throw new Error('AvatarStorage.save não implementado');
  }

  async removeOwned(_userId, _avatarUrl) {
    throw new Error('AvatarStorage.removeOwned não implementado');
  }
}
