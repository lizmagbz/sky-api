export class VerifyRecoveryCode {
  constructor({ authGateway }) {
    this.authGateway = authGateway;
  }

  async execute({ email, code }) {
    return this.authGateway.verifyRecoveryCode({
      email: email.trim().toLowerCase(),
      code: code.trim(),
    });
  }
}
