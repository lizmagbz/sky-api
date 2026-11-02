export class School {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
    };
  }
}
