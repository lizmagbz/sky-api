export class DeleteAccount {
  constructor({ reauthenticateUser, accountErasure }) {
    this.reauthenticateUser = reauthenticateUser;
    this.accountErasure = accountErasure;
  }

  async execute({ userId, password }) {
    await this.reauthenticateUser.execute({ userId, password });
    await this.accountErasure.execute({ userId });
  }
}
