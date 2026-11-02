export class SchoolController {
  constructor({ listAccessibleSchools }) {
    this.listAccessibleSchools = listAccessibleSchools;
  }

  listMine = async (req, res) => {
    const schools = await this.listAccessibleSchools.execute({ userId: req.userId });
    res.status(200).json(schools);
  };
}
