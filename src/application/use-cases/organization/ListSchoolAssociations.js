export class ListSchoolAssociations {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const links = await this.organizationRepository.listSchoolAssociations(userId);
    return links.map((link) => link.toPublic());
  }
}
