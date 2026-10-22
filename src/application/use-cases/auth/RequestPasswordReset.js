export class RequestPasswordReset {
  constructor({ authGateway }) {
    this.authGateway = authGateway;
  }

  async execute({ email }) {
    await this.authGateway.requestPasswordReset({
      email: email.trim().toLowerCase(),
    });
  }
}
