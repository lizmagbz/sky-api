export class OrganizationRepository {
  async listLinkedSchools(_userId) {
    throw new Error('OrganizationRepository.listLinkedSchools não implementado');
  }

  async listAssociationSchools(_userId) {
    throw new Error('OrganizationRepository.listAssociationSchools não implementado');
  }

  async listUnionSchools(_userId) {
    throw new Error('OrganizationRepository.listUnionSchools não implementado');
  }

  async listUnionAssociations(_userId) {
    throw new Error('OrganizationRepository.listUnionAssociations não implementado');
  }

  async findCurrentUnion(_userId) {
    throw new Error('OrganizationRepository.findCurrentUnion não implementado');
  }

  async listSchoolAssociations(_userId) {
    throw new Error('OrganizationRepository.listSchoolAssociations não implementado');
  }
}
