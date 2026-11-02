export class ListUnionSchools {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const schools = await this.organizationRepository.listUnionSchools(userId);
    return schools.map((school) => school.toPublic());
  }
}
