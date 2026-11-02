import { AppError } from '../../domain/errors/AppError.js';

const pageSize = 1000;
const maxDepth = 5;

export function assertStorageReady(serviceRoleKey) {
  if (serviceRoleKey) return;
  throw new AppError('Storage não configurado', 500);
}

export function pathInBucket(fileUrl, bucket) {
  if (typeof fileUrl !== 'string') return null;
  const marker = `/${bucket}/`;
  const withoutQuery = fileUrl.split('?')[0];
  const markerIndex = withoutQuery.indexOf(marker);
  if (markerIndex === -1) return null;
  return decodeURIComponent(withoutQuery.slice(markerIndex + marker.length));
}

export async function listObjectPaths({ url, serviceRoleKey, bucket, prefix }) {
  try {
    return await walkPrefix({ url, serviceRoleKey, bucket, prefix, depth: 0 });
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function mergePaths(known, listed) {
  const paths = new Set(known);
  if (!listed) return [...paths];
  for (const path of listed) paths.add(path);
  return [...paths];
}

export function namedFailures(bucket, prefix, listed, failed) {
  const names = failed.map((path) => `${bucket}/${path}`);
  if (listed) return names;
  return [`list:${bucket}/${prefix}`, ...names];
}

export async function removeObjects({ url, serviceRoleKey, bucket, paths }) {
  const failed = [];
  for (const path of paths) {
    await rememberFailure(failed, { url, serviceRoleKey, bucket, path });
  }
  return failed;
}

async function rememberFailure(failed, target) {
  const removed = await deleteIfPresent(target);
  if (removed) return;
  failed.push(target.path);
}

async function deleteIfPresent({ url, serviceRoleKey, bucket, path }) {
  try {
    const response = await fetch(objectUrl(url, bucket, path), {
      method: 'DELETE',
      headers: storageHeaders(serviceRoleKey),
    });
    if (response.ok) return true;
    if (await isMissing(response)) return true;
    console.error('Falha ao apagar arquivo da conta', bucket, response.status);
    return false;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function isMissing(response) {
  if (response.status === 404) return true;
  const body = await readJson(response);
  const code = String(body.statusCode ?? body.error ?? body.code ?? '').toLowerCase();
  if (code === '404' || code === 'not_found' || code === 'nosuchkey') return true;
  const message = String(body.message ?? '').toLowerCase();
  if (message.includes('not found')) return true;
  return message.includes('nosuchkey');
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function walkPrefix({ url, serviceRoleKey, bucket, prefix, depth }) {
  if (depth > maxDepth) throw new Error('Pasta do storage profunda demais');
  const files = [];
  await collectPages({ url, serviceRoleKey, bucket, prefix, depth, files, offset: 0 });
  return files;
}

async function collectPages(context) {
  const entries = await readPage(context);
  await collectEntries(context, entries);
  if (entries.length < pageSize) return;
  await collectPages({ ...context, offset: context.offset + pageSize });
}

async function readPage({ url, serviceRoleKey, bucket, prefix, offset }) {
  const response = await fetch(`${trimUrl(url)}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix,
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (response.ok) return readEntries(response);
  console.error('Falha ao listar arquivos da conta', bucket, response.status);
  throw new Error('Falha ao listar arquivos da conta');
}

async function readEntries(response) {
  const body = await response.json();
  if (Array.isArray(body)) return body;
  return [];
}

async function collectEntries(context, entries) {
  for (const entry of entries) {
    await collectEntry(context, entry);
  }
}

async function collectEntry(context, entry) {
  if (!entry?.name) return;
  const path = `${context.prefix}${entry.name}`;
  if (entry.id) {
    context.files.push(path);
    return;
  }
  const nested = await walkPrefix({
    url: context.url,
    serviceRoleKey: context.serviceRoleKey,
    bucket: context.bucket,
    prefix: `${path}/`,
    depth: context.depth + 1,
  });
  for (const file of nested) context.files.push(file);
}

function objectUrl(url, bucket, path) {
  return `${trimUrl(url)}/storage/v1/object/${bucket}/${path}`;
}

function storageHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function trimUrl(url) {
  return url.replace(/\/$/, '');
}
