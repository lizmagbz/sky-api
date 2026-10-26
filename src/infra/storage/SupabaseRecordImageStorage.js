import { AppError } from '../../domain/errors/AppError.js';
import { RecordImageStorage } from '../../domain/storage/RecordImageStorage.js';

const recordImagesBucket = 'record-images';

export class SupabaseRecordImageStorage extends RecordImageStorage {
  constructor({ url, serviceRoleKey }) {
    super();
    this.url = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
  }

  async save({ userId, recordId, bytes, contentType, extension }) {
    this.#assertConfigured();
    const path = this.#path(userId, recordId, extension);
    await this.#upload(path, bytes, contentType);
    return { fileUrl: this.#publicUrl(path) };
  }

  async remove(fileUrl) {
    const path = this.#pathFromUrl(fileUrl);
    if (!path) return;
    this.#assertConfigured();
    await this.#delete(path);
  }

  #assertConfigured() {
    if (this.serviceRoleKey) return;
    throw new AppError('Storage não configurado', 500);
  }

  #path(userId, recordId, extension) {
    return `${userId}/${recordId}/${this.#timestamp()}.${extension}`;
  }

  #timestamp() {
    const milliseconds = BigInt(Date.now());
    const fraction = process.hrtime.bigint() % 1000n;
    return (milliseconds * 1000n + fraction).toString();
  }

  async #upload(path, bytes, contentType) {
    const response = await this.#send(path, {
      method: 'POST',
      headers: this.#headers(contentType),
      body: bytes,
    });
    if (response.ok) return;
    console.error('Falha ao gravar imagem do registro', response.status);
    throw new AppError('Falha ao gravar a imagem', 500);
  }

  async #delete(path) {
    const response = await this.#send(path, {
      method: 'DELETE',
      headers: this.#headers(),
    });
    if (response.ok || response.status === 404) return;
    console.error('Falha ao apagar imagem do registro', response.status);
    throw new AppError('Falha ao apagar a imagem', 500);
  }

  async #send(path, request) {
    try {
      return await fetch(this.#objectUrl(path), request);
    } catch (error) {
      console.error(error);
      throw new AppError('Falha ao acessar o armazenamento', 500);
    }
  }

  #objectUrl(path) {
    return `${this.url}/storage/v1/object/${recordImagesBucket}/${path}`;
  }

  #publicUrl(path) {
    return `${this.url}/storage/v1/object/public/${recordImagesBucket}/${path}`;
  }

  #headers(contentType) {
    const headers = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
    };
    if (!contentType) return headers;
    return {
      ...headers,
      'Content-Type': contentType,
      'x-upsert': 'false',
    };
  }

  #pathFromUrl(fileUrl) {
    if (typeof fileUrl !== 'string') return null;
    const marker = `/${recordImagesBucket}/`;
    const withoutQuery = fileUrl.split('?')[0];
    const markerIndex = withoutQuery.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(withoutQuery.slice(markerIndex + marker.length));
  }
}
