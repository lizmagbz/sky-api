export class AuthGateway {
  async signIn(_credentials) {
    throw new Error('AuthGateway.signIn não implementado');
  }

  async signUp(_account) {
    throw new Error('AuthGateway.signUp não implementado');
  }

  async identify(_token) {
    throw new Error('AuthGateway.identify não implementado');
  }

  async requestPasswordReset(_email) {
    throw new Error('AuthGateway.requestPasswordReset não implementado');
  }

  async verifyRecoveryCode(_recovery) {
    throw new Error('AuthGateway.verifyRecoveryCode não implementado');
  }

  async updatePassword(_change) {
    throw new Error('AuthGateway.updatePassword não implementado');
  }

  async updateUserMetadata(_profile) {
    throw new Error('AuthGateway.updateUserMetadata não implementado');
  }
}
