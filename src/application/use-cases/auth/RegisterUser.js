import { AppError } from '../../../domain/errors/AppError.js';

export class RegisterUser {
  constructor({ userRepository, authGateway }) {
    this.userRepository = userRepository;
    this.authGateway = authGateway;
  }

  async execute({ name, email, password, role, schoolId, additionalSchoolIds, unionId }) {
    const account = await this.authGateway.signUp({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      schoolId: this.#primarySchool(unionId, schoolId),
    });
    const user = await this.#findUser(account.userId);
    await this.#applyScope(user.id, { unionId, schoolId, additionalSchoolIds });
    return user.toPublic();
  }

  #primarySchool(unionId, schoolId) {
    if (unionId != null) return undefined;
    return schoolId;
  }

  async #applyScope(userId, { unionId, schoolId, additionalSchoolIds }) {
    if (unionId != null) {
      await this.userRepository.assignUnion(userId, unionId);
      return;
    }

    const schoolIds = this.#schoolIds(schoolId, additionalSchoolIds);
    if (schoolIds.length === 0) return;
    await this.userRepository.linkSchools(userId, schoolIds);
  }

  #schoolIds(schoolId, additionalSchoolIds = []) {
    const ids = [];
    this.#appendSchool(ids, schoolId);
    for (const id of additionalSchoolIds) this.#appendSchool(ids, id);
    return ids;
  }

  #appendSchool(ids, schoolId) {
    if (schoolId == null) return;
    if (ids.includes(schoolId)) return;
    ids.push(schoolId);
  }

  async #findUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('Falha ao criar usuário', 500);
    return user;
  }
}
