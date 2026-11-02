export class UpdatePassword {
  constructor({ authGateway }) {
    this.authGateway = authGateway;
  }

  async execute({ accessToken, password }) {
    await this.authGateway.updatePassword({ accessToken, password });
  }
}
