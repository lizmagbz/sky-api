export class UserRepository {
  async findByEmail(_email) {
    throw new Error('UserRepository.findByEmail não implementado');
  }

  async findById(_id) {
    throw new Error('UserRepository.findById não implementado');
  }

  async assignUnion(_userId, _unionId) {
    throw new Error('UserRepository.assignUnion não implementado');
  }

  async linkSchools(_userId, _schoolIds) {
    throw new Error('UserRepository.linkSchools não implementado');
  }
}
