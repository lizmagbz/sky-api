export class ExternalAccountRemoval {
  constructor({ ownedFileRemoval, authAdmin }) {
    this.ownedFileRemoval = ownedFileRemoval;
    this.authAdmin = authAdmin;
  }

  assertReady() {
    this.authAdmin.assertReady();
    this.ownedFileRemoval.assertReady();
  }

  removeFiles(owned) {
    return this.ownedFileRemoval.remove(owned);
  }

  removeAuth(userId) {
    return this.authAdmin.deleteUser(userId);
  }
}
