const transactionMaxWaitMs = 10000;
const transactionTimeoutMs = 15000;

export class UserDatabaseSession {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async asUser(userId, read) {
    return this.prisma.$transaction((tx) => this.#readAsUser(tx, userId, read), {
      maxWait: transactionMaxWaitMs,
      timeout: transactionTimeoutMs,
    });
  }

  async #readAsUser(tx, userId, read) {
    await this.#assumeUser(tx, userId);
    return read(tx);
  }

  async #assumeUser(tx, userId) {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    await tx.$queryRaw`
      SELECT
        set_config('request.jwt.claim.sub', ${userId}, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', ${claims}, true)
    `;
  }
}
