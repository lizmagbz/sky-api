export class ListPublicSchools {
  constructor({ catalogRepository }) {
    this.catalogRepository = catalogRepository;
  }

  async execute() {
    const schools = await this.catalogRepository.listSchools();
    return schools.map((school) => school.toPublic());
  }
}
