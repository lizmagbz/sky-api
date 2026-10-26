import { AppError } from '../../domain/errors/AppError.js';
import { AvatarStorage } from '../../domain/storage/AvatarStorage.js';
import {
  listObjectPaths,
  mergePaths,
  namedFailures,
  pathInBucket,
  removeObjects,
} from './removeBucketObjects.js';

const avatarsBucket = 'avatars';

export class SupabaseAvatarStorage extends AvatarStorage {
  constructor({ url, serviceRoleKey }) {
    super();
    this.url = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
  }

  assertReady() {
    this.#assertConfigured();
  }

  async save({ userId, bytes }) {
    this.#assertConfigured();
    const path = `${userId}/avatar.jpg`;
    await this.#upload(path, bytes);
    return this.#publicUrl(path);
  }

  async removeOwned(userId, avatarUrl) {
    this.#assertConfigured();
    const prefix = `${userId}/`;
    const listed = await listObjectPaths({
      url: this.url,
      serviceRoleKey: this.serviceRoleKey,
      bucket: avatarsBucket,
      prefix,
    });
    const failed = await removeObjects({
      url: this.url,
      serviceRoleKey: this.serviceRoleKey,
      bucket: avatarsBucket,
      paths: mergePaths(this.#knownPaths(userId, avatarUrl), listed),
    });
    return namedFailures(avatarsBucket, prefix, listed, failed);
  }

  #assertConfigured() {
    if (this.serviceRoleKey) return;
    throw new AppError('Storage não configurado', 500);
  }

  #knownPaths(userId, avatarUrl) {
    const paths = new Set([`${userId}/avatar.jpg`]);
    const stored = pathInBucket(avatarUrl, avatarsBucket);
    if (!stored) return paths;
    paths.add(stored);
    return paths;
  }

  async #upload(path, bytes) {
    const response = await this.#fetch(path, bytes);
    if (response.ok) return;
    console.error('Falha ao gravar avatar', response.status);
    throw new AppError('Falha ao gravar avatar', 500);
  }

  async #fetch(path, bytes) {
    try {
      return await fetch(`${this.url}/storage/v1/object/${avatarsBucket}/${path}`, {
        method: 'POST',
        headers: this.#headers(),
        body: bytes,
      });
    } catch (error) {
      console.error(error);
      throw new AppError('Falha ao gravar avatar', 500);
    }
  }

  #headers() {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    };
  }

  #publicUrl(path) {
    return `${this.url}/storage/v1/object/public/${avatarsBucket}/${path}?v=${Date.now()}`;
  }
}
