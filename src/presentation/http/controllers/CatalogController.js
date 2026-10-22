export class CatalogController {
  constructor({ listPublicSchools, listPublicUnions }) {
    this.listPublicSchools = listPublicSchools;
    this.listPublicUnions = listPublicUnions;
  }

  listSchools = async (_req, res) => {
    const schools = await this.listPublicSchools.execute();
    res.status(200).json(schools);
  };

  listUnions = async (_req, res) => {
    const unions = await this.listPublicUnions.execute();
    res.status(200).json(unions);
  };
}
