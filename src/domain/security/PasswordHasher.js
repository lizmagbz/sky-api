export class PasswordHasher {
  async hash(_plainText) {
    throw new Error('PasswordHasher.hash não implementado');
  }

  async compare(_plainText, _passwordHash) {
    throw new Error('PasswordHasher.compare não implementado');
  }
}
