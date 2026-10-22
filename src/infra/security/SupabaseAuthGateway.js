import { AppError } from '../../domain/errors/AppError.js';
import { AuthGateway } from '../../domain/security/AuthGateway.js';

const recoveryRedirectUrl = 'com.mablye.sky://reset-password';

export class SupabaseAuthGateway extends AuthGateway {
  constructor({ url, anonKey }) {
    super();
    this.url = url.replace(/\/$/, '');
    this.anonKey = anonKey;
  }

  async signIn({ email, password }) {
    const body = await this.#post('/token?grant_type=password', { email, password }, 'signIn');
    if (!body.access_token || !body.user?.id) {
      throw new AppError('Credenciais inválidas', 401);
    }

    return { accessToken: body.access_token, userId: body.user.id };
  }

  async signUp({ email, password, name, role, schoolId }) {
    const body = await this.#post('/signup', {
      email,
      password,
      data: this.#signupData({ name, role, schoolId }),
    }, 'signUp');
    if (this.#isDuplicateIdentity(body)) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const userId = body.user?.id ?? body.id;
    if (!userId) throw new AppError('Falha ao criar usuário', 500);
    return { userId };
  }

  #signupData({ name, role, schoolId }) {
    const data = { name };
    if (role) data.role = role;
    if (schoolId != null) data.school_id = schoolId;
    return data;
  }

  async identify(token) {
    const body = await this.#get('/user', token);
    if (!body.id) throw new AppError('Token inválido ou expirado', 401);
    return { userId: body.id };
  }

  async requestPasswordReset({ email }) {
    const response = await this.#fetch(this.#recoverPath(), {
      method: 'POST',
      payload: { email },
    });
    const body = await this.#readBody(response);
    if (response.ok) return;
    if (this.#isUnknownAccount(body)) return;
    throw this.#toError(response.status, body, 'recover');
  }

  async verifyRecoveryCode({ email, code }) {
    const body = await this.#post('/verify', this.#recoveryProof(email, code), 'verifyRecovery');
    if (!body.access_token) throw new AppError('Código inválido ou expirado', 401);
    return { accessToken: body.access_token };
  }

  #recoveryProof(email, code) {
    if (code.length > 12) return { type: 'recovery', token_hash: code };
    return { type: 'recovery', email, token: code };
  }

  async updatePassword({ accessToken, password }) {
    await this.#put('/user', { password }, accessToken, 'updatePassword');
  }

  #recoverPath() {
    return `/recover?redirect_to=${encodeURIComponent(recoveryRedirectUrl)}`;
  }

  async #post(path, payload, purpose) {
    return this.#send(path, { method: 'POST', payload, purpose });
  }

  async #put(path, payload, token, purpose) {
    return this.#send(path, { method: 'PUT', payload, token, purpose });
  }

  async #get(path, token) {
    return this.#send(path, { method: 'GET', token, purpose: 'identify' });
  }

  async #send(path, { method, payload, token, purpose }) {
    const response = await this.#fetch(path, { method, payload, token });
    const body = await this.#readBody(response);
    if (response.ok) return body;
    throw this.#toError(response.status, body, purpose);
  }

  async #fetch(path, { method, payload, token }) {
    try {
      return await fetch(`${this.url}/auth/v1${path}`, {
        method,
        headers: this.#headers(token),
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } catch {
      throw new AppError('Falha ao autenticar', 500);
    }
  }

  #headers(token) {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${token || this.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  async #readBody(response) {
    const text = await response.text();
    if (!text) return {};
    return this.#parseJson(text);
  }

  #parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  #toError(status, body, purpose) {
    if (purpose === 'signIn' && status < 500) {
      return new AppError('Credenciais inválidas', 401);
    }

    if (purpose === 'identify') {
      return new AppError('Token inválido ou expirado', 401);
    }

    if (purpose === 'verifyRecovery' && status < 500) {
      return new AppError('Código inválido ou expirado', 401);
    }

    if (purpose === 'recover') {
      return this.#recoverError(status, body);
    }

    if (purpose === 'updatePassword') {
      return this.#updatePasswordError(status, body);
    }

    if (this.#isDuplicate(body)) {
      return new AppError('E-mail já cadastrado', 409);
    }

    if (status >= 500) return new AppError('Falha ao autenticar', 500);
    return new AppError('Falha ao criar usuário', 400);
  }

  #recoverError(status, body) {
    if (this.#isRateLimit(body)) {
      return new AppError('Aguarde alguns segundos antes de solicitar um novo e-mail.', 429);
    }
    if (status >= 500) return new AppError('Falha ao autenticar', 500);
    return new AppError('Não foi possível enviar o e-mail de recuperação', 400);
  }

  #updatePasswordError(status, body) {
    if (status === 401) return new AppError('Token inválido ou expirado', 401);
    if (status === 422 || this.#isWeakPassword(body)) {
      return new AppError('Senha não atende aos requisitos', 400);
    }
    if (status >= 500) return new AppError('Falha ao autenticar', 500);
    return new AppError('Não foi possível redefinir a senha', 400);
  }

  #isDuplicate(body) {
    return this.#mentionsExistingAccount(this.#errorText(body));
  }

  #isUnknownAccount(body) {
    const text = this.#errorText(body);
    if (text.includes('user_not_found')) return true;
    if (text.includes('user not found')) return true;
    if (text.includes('email not found')) return true;
    return false;
  }

  #isRateLimit(body) {
    const text = this.#errorText(body);
    if (text.includes('over_email_send_rate_limit')) return true;
    if (text.includes('rate limit')) return true;
    if (text.includes('too many')) return true;
    return false;
  }

  #isWeakPassword(body) {
    const text = this.#errorText(body);
    if (text.includes('password')) return true;
    if (text.includes('weak')) return true;
    return false;
  }

  #errorText(body) {
    const code = String(body.code ?? body.error_code ?? body.error ?? '');
    const description = String(body.msg ?? body.error_description ?? body.message ?? '');
    return `${code} ${description}`.toLowerCase();
  }

  #mentionsExistingAccount(text) {
    const normalized = text.toLowerCase();
    if (normalized.includes('user_already_exists')) return true;
    if (normalized.includes('email_exists')) return true;
    if (normalized.includes('already registered')) return true;
    if (normalized.includes('already been registered')) return true;
    return false;
  }

  #isDuplicateIdentity(body) {
    const identities = body.user?.identities ?? body.identities;
    return Array.isArray(identities) && identities.length === 0;
  }
}
