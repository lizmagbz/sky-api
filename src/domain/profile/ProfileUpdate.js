import { AppError } from '../errors/AppError.js';
import { unionCoordinatorRole } from './appRoles.js';

export class ProfileUpdate {
  constructor({ profile, patch }) {
    this.profile = profile;
    this.patch = patch;
  }

  assertAllowed() {
    this.#rejectEmpty();
    if (this.#nextRole() === unionCoordinatorRole) {
      this.#assertUnionCoordinator();
      return;
    }
    this.#rejectUnionAssignment();
  }

  toChange() {
    return {
      name: this.patch.name,
      role: this.patch.role,
      avatarFocusX: this.patch.avatarFocusX,
      avatarFocusY: this.patch.avatarFocusY,
      avatarFocusScale: this.patch.avatarFocusScale,
      unionId: this.#assignedUnionId(),
      clearUnion: this.#clearsUnion(),
      removeSchoolLinks: this.#removesSchoolLinks(),
    };
  }

  authData() {
    const data = {};
    if (this.patch.name != null) data.name = this.patch.name;
    if (this.#assignedUnionId() != null) data.union_id = this.#assignedUnionId();
    if (this.#clearsUnion()) data.union_id = null;
    return data;
  }

  #rejectEmpty() {
    if (this.#hasField()) return;
    throw new AppError('Nenhum campo para atualizar', 400);
  }

  #hasField() {
    return Object.values(this.patch).some((value) => value !== undefined);
  }

  #nextRole() {
    if (this.patch.role) return this.patch.role;
    return this.profile.role();
  }

  #assertUnionCoordinator() {
    if (this.patch.unionId === null) {
      throw new AppError('Selecione sua união', 400);
    }
    if (this.#keepsCurrentUnion()) return;
    if (this.patch.unionId != null) return;
    throw new AppError('Selecione sua união', 400);
  }

  #keepsCurrentUnion() {
    if (this.patch.unionId != null) return false;
    if (this.#changesIntoUnionRole()) return false;
    return this.profile.hasUnion();
  }

  #changesIntoUnionRole() {
    if (this.patch.role !== unionCoordinatorRole) return false;
    return !this.profile.isUnionCoordinator();
  }

  #rejectUnionAssignment() {
    if (this.patch.unionId == null) return;
    throw new AppError('Este papel não permite união', 400);
  }

  #assignedUnionId() {
    if (this.#nextRole() !== unionCoordinatorRole) return undefined;
    if (this.patch.unionId == null) return undefined;
    return this.patch.unionId;
  }

  #clearsUnion() {
    if (this.#nextRole() === unionCoordinatorRole) return false;
    if (this.patch.role) return true;
    return this.patch.unionId === null;
  }

  #removesSchoolLinks() {
    if (this.#nextRole() !== unionCoordinatorRole) return false;
    if (this.patch.unionId != null) return true;
    return this.patch.role === unionCoordinatorRole;
  }
}
