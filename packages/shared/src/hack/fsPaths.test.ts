import { describe, it, expect } from 'vitest';
import {
  normalizeFsPath,
  parentPathOf,
  basenameOf,
  toolPath,
  isValidFsName,
  FsPathError,
} from './fsPaths.js';
import { loadFilesystemBalance } from './balanceLoader.js';
import { wouldExceedCapacity } from './fsCapacity.js';

describe('fsPaths', () => {
  it('normalizes absolute paths', () => {
    expect(normalizeFsPath('/bin/cracker_l1.v1')).toBe('/bin/cracker_l1.v1');
    expect(normalizeFsPath('bin/cracker_l1.v1')).toBe('/bin/cracker_l1.v1');
  });

  it('rejects traversal and empty segments', () => {
    expect(() => normalizeFsPath('/bin/../etc')).toThrow(FsPathError);
    expect(() => normalizeFsPath('/')).toThrow(FsPathError);
    expect(() => normalizeFsPath('/bin/./x')).toThrow(FsPathError);
  });

  it('computes parent and basename', () => {
    expect(parentPathOf('/bin/cracker_l1.v1')).toBe('/bin');
    expect(parentPathOf('/bin')).toBe(null);
    expect(basenameOf('/bin/cracker_l1.v1')).toBe('cracker_l1.v1');
  });

  it('builds tool paths', () => {
    expect(toolPath('cracker_l1')).toBe('/bin/cracker_l1.v1');
    expect(isValidFsName('ok')).toBe(true);
    expect(isValidFsName('a/b')).toBe(false);
  });
});

describe('filesystem balance', () => {
  it('loads tool QGB sizes', () => {
    const bal = loadFilesystemBalance();
    expect(bal.defaultRigStorageQgb).toBe(1000);
    expect(bal.toolSizeQgb.cracker_l1).toBe(12);
    expect(bal.toolSizeQgb.anti_firewall_l1).toBe(90);
    expect(bal.defaultToolSizeQgb).toBe(10);
  });

  it('starter tools fit in default capacity', () => {
    const bal = loadFilesystemBalance();
    const starter = ['cracker_l1', 'anti_firewall_l1'];
    const used = starter.reduce(
      (s, id) => s + (bal.toolSizeQgb[id] ?? bal.defaultToolSizeQgb),
      0,
    );
    expect(wouldExceedCapacity(0, bal.defaultRigStorageQgb, used)).toBe(false);
    expect(wouldExceedCapacity(990, 1000, 20)).toBe(true);
  });
});
