export class ListPublicUnions {
  constructor({ catalogRepository }) {
    this.catalogRepository = catalogRepository;
  }

  async execute() {
    const unions = await this.catalogRepository.listUnions();
    return unions.map((union) => union.toPublic());
  }
}
