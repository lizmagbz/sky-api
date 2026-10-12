export class TokenProvider {
  sign(_payload) {
    throw new Error('TokenProvider.sign não implementado');
  }

  verify(_token) {
    throw new Error('TokenProvider.verify não implementado');
  }
}
