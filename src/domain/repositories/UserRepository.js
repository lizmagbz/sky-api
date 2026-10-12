export class UserRepository {
  async findByEmail(_email) {
    throw new Error('UserRepository.findByEmail não implementado');
  }

  async findById(_id) {
    throw new Error('UserRepository.findById não implementado');
  }

  async create(_data) {
    throw new Error('UserRepository.create não implementado');
  }
}
