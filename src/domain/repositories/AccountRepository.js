export class AccountRepository {
  async listOwned(_userId) {
    throw new Error('AccountRepository.listOwned não implementado');
  }

  async erase(_userId) {
    throw new Error('AccountRepository.erase não implementado');
  }

  async remaining(_userId) {
    throw new Error('AccountRepository.remaining não implementado');
  }
}
