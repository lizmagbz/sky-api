export class GetCurrentUnion {
  constructor({ organizationRepository }) {
    this.organizationRepository = organizationRepository;
  }

  async execute({ userId }) {
    const union = await this.organizationRepository.findCurrentUnion(userId);
    if (!union) return null;
    return union.toPublic();
  }
}
