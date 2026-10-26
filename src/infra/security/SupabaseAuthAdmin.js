import { AppError } from '../../domain/errors/AppError.js';
import { AuthAdmin } from '../../domain/security/AuthAdmin.js';

export class SupabaseAuthAdmin extends AuthAdmin {
  constructor({ url, serviceRoleKey }) {
    super();
    this.url = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
  }

  assertReady() {
    if (this.serviceRoleKey) return;
    throw new AppError('Exclusão de conta não configurada', 500);
  }

  async deleteUser(userId) {
    this.assertReady();
    const response = await this.#send(userId);
    if (response.ok) return;
    if (response.status === 404) return;
    console.error('Falha ao apagar usuário no Auth', response.status);
    throw new AppError('Falha ao apagar o usuário', 500);
  }

  async #send(userId) {
    try {
      return await fetch(this.#userUrl(userId), {
        method: 'DELETE',
        headers: this.#headers(),
        body: JSON.stringify({ should_soft_delete: false }),
      });
    } catch (error) {
      console.error(error);
      throw new AppError('Falha ao apagar o usuário', 500);
    }
  }

  #userUrl(userId) {
    return `${this.url}/auth/v1/admin/users/${userId}`;
  }

  #headers() {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
  }
}
