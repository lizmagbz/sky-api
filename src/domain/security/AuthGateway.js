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
}
