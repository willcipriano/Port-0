const NAME_RE = /^[^/\\]+$/;
const PATH_RE = /^(\/[^/]+)+$/;

export class FsPathError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FsPathError';
  }
}

export function normalizeFsPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/') {
    throw new FsPathError('invalid_path', 'Path must be absolute and non-root');
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const parts = withSlash.split('/').filter(Boolean);
  if (parts.length === 0) {
    throw new FsPathError('invalid_path', 'Path must be absolute and non-root');
  }
  for (const part of parts) {
    if (part === '.' || part === '..' || !NAME_RE.test(part)) {
      throw new FsPathError('invalid_path', `Invalid path segment: ${part}`);
    }
  }
  const path = `/${parts.join('/')}`;
  if (!PATH_RE.test(path)) {
    throw new FsPathError('invalid_path', `Invalid path: ${path}`);
  }
  return path;
}

export function parentPathOf(path: string): string | null {
  const normalized = normalizeFsPath(path);
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx) || null;
}

export function basenameOf(path: string): string {
  const normalized = normalizeFsPath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function toolFileName(toolId: string): string {
  return `${toolId}.v1`;
}

export function toolPath(toolId: string): string {
  return `/bin/${toolFileName(toolId)}`;
}

export function isValidFsName(name: string): boolean {
  return Boolean(name) && NAME_RE.test(name) && name !== '.' && name !== '..';
}
