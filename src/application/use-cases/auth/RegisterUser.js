import { AppError } from '../../../domain/errors/AppError.js';

export class RegisterUser {
  constructor({ userRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    return user.toPublic();
  }
}
