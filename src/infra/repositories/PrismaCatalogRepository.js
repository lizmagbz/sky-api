import { CatalogItem } from '../../domain/entities/CatalogItem.js';
import { AppError } from '../../domain/errors/AppError.js';
import { CatalogRepository } from '../../domain/repositories/CatalogRepository.js';

export class PrismaCatalogRepository extends CatalogRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async listSchools() {
    return this.#list(this.prisma.school, 'Falha ao consultar escolas');
  }

  async listUnions() {
    return this.#list(this.prisma.union, 'Falha ao consultar uniões');
  }

  async #list(model, message) {
    try {
      const rows = await model.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => new CatalogItem({ id: Number(row.id), name: row.name }));
    } catch (error) {
      console.error(error);
      throw new AppError(message, 500);
    }
  }
}
