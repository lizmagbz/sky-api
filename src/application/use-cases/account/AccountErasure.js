import { AppError } from '../../../domain/errors/AppError.js';

export class AccountErasure {
  constructor({ accountRepository, externalRemoval }) {
    this.accountRepository = accountRepository;
    this.externalRemoval = externalRemoval;
  }

  async execute({ userId }) {
    this.externalRemoval.assertReady();
    const owned = await this.accountRepository.listOwned(userId);
    await this.#removeFiles(userId, owned);
    await this.#eraseRows(userId);
    await this.#removeAuth(userId);
  }

  async #removeFiles(userId, owned) {
    const failed = await this.#files(userId, owned);
    if (failed.length === 0) return;
    await this.#record(userId, 'arquivos', failed);
  }

  async #files(userId, owned) {
    try {
      return await this.externalRemoval.removeFiles({ userId, ...owned });
    } catch (error) {
      console.error(error);
      return [error.message];
    }
  }

  async #eraseRows(userId) {
    try {
      await this.accountRepository.erase(userId);
    } catch (error) {
      await this.#record(userId, 'dados', error);
    }
  }

  async #removeAuth(userId) {
    try {
      await this.externalRemoval.removeAuth(userId);
    } catch (error) {
      await this.#record(userId, 'auth', error);
    }
  }

  async #record(userId, step, cause) {
    const remaining = await this.#readRemaining(userId);
    const detail = this.#detail(cause);
    const note = this.#note(step);
    if (cause instanceof Error) console.error(cause);
    console.error('Exclusão de conta incompleta', { userId, step, note, remaining, detail });
    throw new AppError('Não foi possível concluir a exclusão da conta', 500, {
      step,
      note,
      remaining,
      detail,
    });
  }

  #note(step) {
    if (step === 'arquivos') {
      return 'Os caminhos em detail continuam no bucket. Outros arquivos dessa conta podem já ter sido apagados. As linhas da conta não foram apagadas.';
    }
    if (step === 'dados') {
      return 'Os arquivos do bucket já foram apagados. As linhas da conta continuam no banco.';
    }
    return 'Vínculos, metas, agenda e registros já foram apagados. O usuário em public.user e no Auth pode continuar existindo.';
  }

  async #readRemaining(userId) {
    try {
      return await this.accountRepository.remaining(userId);
    } catch (error) {
      console.error(error);
      return { consulta: 'indisponível' };
    }
  }

  #detail(cause) {
    if (Array.isArray(cause)) return cause;
    if (cause instanceof Error) return cause.message;
    return String(cause ?? '');
  }
}
