import { unionCoordinatorRole } from '../profile/appRoles.js';

export class UserProfile {
  constructor(data) {
    this.data = data;
  }

  role() {
    return this.data.role;
  }

  hasUnion() {
    return this.data.union_id != null;
  }

  isUnionCoordinator() {
    return this.data.role === unionCoordinatorRole;
  }

  toPublic() {
    return this.data;
  }
}
