export class UnionSchool {
  constructor({ id, name, associationId }) {
    this.id = id;
    this.name = name;
    this.associationId = associationId;
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      association_id: this.associationId,
    };
  }
}
