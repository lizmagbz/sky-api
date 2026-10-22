export class ListLinkedSchools {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const schools = await this.organizationRepository.listLinkedSchools(userId);
    return schools.map((school) => school.toPublic());
  }
}
