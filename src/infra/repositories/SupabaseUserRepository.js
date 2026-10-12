import { User } from '../../domain/entities/User.js';
import { AppError } from '../../domain/errors/AppError.js';
import { UserRepository } from '../../domain/repositories/UserRepository.js';

export class SupabaseUserRepository extends UserRepository {
  constructor(supabase) {
    super();
    this.supabase = supabase;
  }

  async findByEmail(email) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, name, email, password_hash, created_at')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new AppError('Falha ao consultar usuário', 500);
    }

    return data ? this.#toEntity(data) : null;
  }

  async findById(id) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, name, email, password_hash, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new AppError('Falha ao consultar usuário', 500);
    }

    return data ? this.#toEntity(data) : null;
  }

  async create({ name, email, passwordHash }) {
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        name,
        email,
        password_hash: passwordHash,
      })
      .select('id, name, email, password_hash, created_at')
      .single();

    if (error) {
      throw new AppError('Falha ao criar usuário', 500);
    }

    return this.#toEntity(data);
  }

  #toEntity(row) {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    });
  }
}
