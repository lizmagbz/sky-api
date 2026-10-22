export class OrganizationController {
  constructor({
    listLinkedSchools,
    listAssociationSchools,
    listUnionSchools,
    listUnionAssociations,
    getCurrentUnion,
    listSchoolAssociations,
  }) {
    this.listLinkedSchools = listLinkedSchools;
    this.listAssociationSchools = listAssociationSchools;
    this.listUnionSchools = listUnionSchools;
    this.listUnionAssociations = listUnionAssociations;
    this.getCurrentUnion = getCurrentUnion;
    this.listSchoolAssociations = listSchoolAssociations;
  }

  listLinked = async (req, res) => {
    const schools = await this.listLinkedSchools.execute({ userId: req.userId });
    res.status(200).json(schools);
  };

  listAssociation = async (req, res) => {
    const schools = await this.listAssociationSchools.execute({ userId: req.userId });
    res.status(200).json(schools);
  };

  listByUnion = async (req, res) => {
    const schools = await this.listUnionSchools.execute({ userId: req.userId });
    res.status(200).json(schools);
  };

  listAssociations = async (req, res) => {
    const associations = await this.listUnionAssociations.execute({ userId: req.userId });
    res.status(200).json(associations);
  };

  currentUnion = async (req, res) => {
    const union = await this.getCurrentUnion.execute({ userId: req.userId });
    res.status(200).json(union);
  };

  listSchoolMap = async (req, res) => {
    const links = await this.listSchoolAssociations.execute({ userId: req.userId });
    res.status(200).json(links);
  };
}
