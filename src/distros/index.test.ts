import { describe, it, expect } from 'vitest';
import { getDistroHandler, DebianHandler, ArchHandler, AlpineHandler, FedoraHandler, OpenSUSEHandler } from './index';

describe('getDistroHandler', () => {
  it('should return DebianHandler for debian', () => {
    const handler = getDistroHandler('debian');
    expect(handler).toBeInstanceOf(DebianHandler);
    expect(handler.name).toBe('Debian/Ubuntu');
  });

  it('should return DebianHandler for ubuntu', () => {
    const handler = getDistroHandler('ubuntu');
    expect(handler).toBeInstanceOf(DebianHandler);
    expect(handler.name).toBe('Debian/Ubuntu');
  });

  it('should return DebianHandler for DEBIAN (uppercase)', () => {
    const handler = getDistroHandler('DEBIAN');
    expect(handler).toBeInstanceOf(DebianHandler);
  });

  it('should return DebianHandler for Ubuntu (mixed case)', () => {
    const handler = getDistroHandler('Ubuntu');
    expect(handler).toBeInstanceOf(DebianHandler);
  });

  it('should return ArchHandler for arch', () => {
    const handler = getDistroHandler('arch');
    expect(handler).toBeInstanceOf(ArchHandler);
    expect(handler.name).toBe('Arch Linux');
  });

  it('should return ArchHandler for archlinux', () => {
    const handler = getDistroHandler('archlinux');
    expect(handler).toBeInstanceOf(ArchHandler);
  });

  it('should return ArchHandler for ArchLinux (mixed case)', () => {
    const handler = getDistroHandler('ArchLinux');
    expect(handler).toBeInstanceOf(ArchHandler);
  });

  it('should return AlpineHandler for alpine', () => {
    const handler = getDistroHandler('alpine');
    expect(handler).toBeInstanceOf(AlpineHandler);
    expect(handler.name).toBe('Alpine Linux');
  });

  it('should return AlpineHandler for alpinelinux', () => {
    const handler = getDistroHandler('alpinelinux');
    expect(handler).toBeInstanceOf(AlpineHandler);
  });

  it('should return AlpineHandler for AlpineLinux (mixed case)', () => {
    const handler = getDistroHandler('AlpineLinux');
    expect(handler).toBeInstanceOf(AlpineHandler);
  });

  it('should return FedoraHandler for fedora', () => {
    const handler = getDistroHandler('fedora');
    expect(handler).toBeInstanceOf(FedoraHandler);
    expect(handler.name).toBe('Fedora');
  });

  it('should return FedoraHandler for FEDORA (uppercase)', () => {
    const handler = getDistroHandler('FEDORA');
    expect(handler).toBeInstanceOf(FedoraHandler);
  });

  it('should return OpenSUSEHandler for opensuse', () => {
    const handler = getDistroHandler('opensuse');
    expect(handler).toBeInstanceOf(OpenSUSEHandler);
    expect(handler.name).toBe('openSUSE');
  });

  it('should return OpenSUSEHandler for suse', () => {
    const handler = getDistroHandler('suse');
    expect(handler).toBeInstanceOf(OpenSUSEHandler);
  });

  it('should return OpenSUSEHandler for OpenSUSE (mixed case)', () => {
    const handler = getDistroHandler('OpenSUSE');
    expect(handler).toBeInstanceOf(OpenSUSEHandler);
  });

  it('should throw error for unsupported distribution', () => {
    expect(() => getDistroHandler('centos')).toThrow(
      'Unsupported distribution: centos. Supported: debian, ubuntu, arch, alpine, fedora, opensuse'
    );
  });

  it('should throw error for empty string', () => {
    expect(() => getDistroHandler('')).toThrow(
      'Unsupported distribution: . Supported: debian, ubuntu, arch, alpine, fedora, opensuse'
    );
  });

  it('should throw error for unknown distribution', () => {
    expect(() => getDistroHandler('unknown')).toThrow(
      'Unsupported distribution: unknown. Supported: debian, ubuntu, arch, alpine, fedora, opensuse'
    );
  });

  it('should throw error for whitespace-only distribution', () => {
    expect(() => getDistroHandler('   ')).toThrow(
      'Unsupported distribution:    . Supported: debian, ubuntu, arch, alpine, fedora, opensuse'
    );
  });
});

describe('Exports', () => {
  it('should export DistroHandler interface', () => {
    // TypeScript compile-time check - if this compiles, the export works
    const checkType: typeof import('./index').DistroHandler = {} as unknown as import('./base').DistroHandler;
    expect(checkType).toBeDefined();
  });

  it('should export DistroConfig interface', () => {
    const checkType: typeof import('./index').DistroConfig = {} as unknown as import('./base').DistroConfig;
    expect(checkType).toBeDefined();
  });

  it('should export all handler classes', () => {
    expect(DebianHandler).toBeDefined();
    expect(ArchHandler).toBeDefined();
    expect(AlpineHandler).toBeDefined();
    expect(FedoraHandler).toBeDefined();
    expect(OpenSUSEHandler).toBeDefined();
  });

  it('should export getDistroHandler function', () => {
    expect(getDistroHandler).toBeDefined();
    expect(typeof getDistroHandler).toBe('function');
  });
});
