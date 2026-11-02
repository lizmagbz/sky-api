import { Topic } from '../../domain/entities/Topic.js';
import { AppError } from '../../domain/errors/AppError.js';
import { TopicRepository } from '../../domain/repositories/TopicRepository.js';

export class PrismaTopicRepository extends TopicRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async list() {
    try {
      const rows = await this.prisma.topic.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => new Topic({ id: Number(row.id), name: row.name }));
    } catch (error) {
      console.error(error);
      throw new AppError('Falha ao consultar tópicos', 500);
    }
  }
}
