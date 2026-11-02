export class ListAccessibleSchools {
  constructor({ accessibleSchoolRepository }) {
    this.accessibleSchoolRepository = accessibleSchoolRepository;
  }

  async execute({ userId }) {
    const schools = await this.accessibleSchoolRepository.listFor(userId);
    return schools.map((school) => school.toPublic());
  }
}
