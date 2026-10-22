export class ListUnionAssociations {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const associations = await this.organizationRepository.listUnionAssociations(userId);
    return associations.map((association) => association.toPublic());
  }
}
