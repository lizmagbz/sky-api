export class ListAssociationSchools {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const schools = await this.organizationRepository.listAssociationSchools(userId);
    return schools.map((school) => school.toPublic());
  }
}
