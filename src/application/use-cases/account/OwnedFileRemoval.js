export class OwnedFileRemoval {
  constructor({ avatarStorage, recordImageStorage }) {
    this.avatarStorage = avatarStorage;
    this.recordImageStorage = recordImageStorage;
  }

  assertReady() {
    this.avatarStorage.assertReady();
    this.recordImageStorage.assertReady();
  }

  async remove({ userId, recordFileUrls, avatarUrl }) {
    const recordFailures = await this.#records(userId, recordFileUrls);
    const avatarFailures = await this.#avatar(userId, avatarUrl);
    return [...recordFailures, ...avatarFailures];
  }

  async #records(userId, recordFileUrls) {
    try {
      return await this.recordImageStorage.removeOwned(userId, recordFileUrls);
    } catch (error) {
      console.error(error);
      return [`record-images:${error.message}`];
    }
  }

  async #avatar(userId, avatarUrl) {
    try {
      return await this.avatarStorage.removeOwned(userId, avatarUrl);
    } catch (error) {
      console.error(error);
      return [`avatars:${error.message}`];
    }
  }
}
