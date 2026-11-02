export class SchoolAssociationLink {
  constructor({ id, associationId }) {
    this.id = id;
    this.associationId = associationId;
  }

  toPublic() {
    return {
      id: this.id,
      association_id: this.associationId,
    };
  }
}
