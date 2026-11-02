const imageTypes = {
  'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/jpg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/png': { extension: 'png', contentType: 'image/png' },
  'image/webp': { extension: 'webp', contentType: 'image/webp' },
};

export function recordImageType(contentType) {
  if (!contentType) return null;
  const base = contentType.split(';')[0].trim().toLowerCase();
  return imageTypes[base] ?? null;
}
