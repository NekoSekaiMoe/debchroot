import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebianHandler } from './debian';
import * as exec from '../utils/exec';
import * as system from '../utils/system';
import * as core from '@actions/core';

vi.mock('../utils/exec');
vi.mock('../utils/system');
vi.mock('@actions/core');

describe('DebianHandler', () => {
  let handler: DebianHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new DebianHandler();
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('Debian/Ubuntu');
    });
  });

  describe('validateEnvironment', () => {
    it('should resolve without error', async () => {
      await expect(handler.validateEnvironment()).resolves.toBeUndefined();
    });
  });

  describe('installTools', () => {
    beforeEach(() => {
      vi.mocked(system.installPackages).mockResolvedValue(undefined);
    });

    it('should install debootstrap and qemu-user-static with apt', async () => {
      await handler.installTools('apt');

      expect(system.installPackages).toHaveBeenCalledWith('apt', [
        'debootstrap',
        'qemu-user-static',
      ]);
    });

    it('should install debootstrap and qemu-user-static with dnf', async () => {
      await handler.installTools('dnf');

      expect(system.installPackages).toHaveBeenCalledWith('dnf', [
        'debootstrap',
        'qemu-user-static',
      ]);
    });

    it('should install debootstrap and qemu-user-static with zypper', async () => {
      await handler.installTools('zypper');

      expect(system.installPackages).toHaveBeenCalledWith('zypper', [
        'debootstrap',
        'qemu-user-static',
      ]);
    });

    it('should install debootstrap and qemu-user-static with pacman', async () => {
      await handler.installTools('pacman');

      expect(system.installPackages).toHaveBeenCalledWith('pacman', [
        'debootstrap',
        'qemu-user-static',
      ]);
    });

    it('should propagate errors from installPackages', async () => {
      vi.mocked(system.installPackages).mockRejectedValue(new Error('Install failed'));

      await expect(handler.installTools('apt')).rejects.toThrow('Install failed');
    });
  });

  describe('createRootfs', () => {
    const baseConfig = {
      name: 'debian',
      arch: 'arm64',
      version: 'bookworm',
      packages: [] as string[],
      rootfs: '/home/user/rootfs',
    };

    beforeEach(() => {
      vi.mocked(system.getSudo).mockResolvedValue('sudo');
      vi.mocked(exec.execWithOutput).mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
      });
    });

    it('should create rootfs with sudo and correct arguments', async () => {
      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'arm64',
        'bookworm',
        '/home/user/rootfs',
      ]);
    });

    it('should create rootfs without sudo when running as root', async () => {
      vi.mocked(system.getSudo).mockResolvedValue('');

      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('debootstrap', [
        '--variant=minbase',
        '--arch',
        'arm64',
        'bookworm',
        '/home/user/rootfs',
      ]);
    });

    it('should install additional packages when specified', async () => {
      const configWithPackages = {
        ...baseConfig,
        packages: ['curl', 'git'],
      };

      await handler.createRootfs(configWithPackages);

      // Should call debootstrap first
      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'arm64',
        'bookworm',
        '/home/user/rootfs',
      ]);

      // Should call apt-get update in chroot
      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'chroot',
        '/home/user/rootfs',
        'apt-get',
        'update',
      ]);

      // Should call apt-get install in chroot
      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'chroot',
        '/home/user/rootfs',
        'apt-get',
        'install',
        '-y',
        '--no-install-recommends',
        'curl',
        'git',
      ]);

      // Should log package installation
      expect(core.info).toHaveBeenCalledWith('Installing additional packages: curl git');
    });

    it('should not install packages when packages array is empty', async () => {
      await handler.createRootfs(baseConfig);

      const calls = vi.mocked(exec.execWithOutput).mock.calls;
      expect(calls.length).toBe(1); // Only debootstrap
      expect(calls[0]).toEqual([
        'sudo',
        [
          'debootstrap',
          '--variant=minbase',
          '--arch',
          'arm64',
          'bookworm',
          '/home/user/rootfs',
        ],
      ]);
    });

    it('should handle different architectures', async () => {
      const configAmd64 = {
        ...baseConfig,
        arch: 'amd64',
      };

      await handler.createRootfs(configAmd64);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'amd64',
        'bookworm',
        '/home/user/rootfs',
      ]);
    });

    it('should handle different versions', async () => {
      const configBullseye = {
        ...baseConfig,
        version: 'bullseye',
      };

      await handler.createRootfs(configBullseye);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'arm64',
        'bullseye',
        '/home/user/rootfs',
      ]);
    });

    it('should handle different rootfs paths', async () => {
      const configCustomPath = {
        ...baseConfig,
        rootfs: '/custom/path',
      };

      await handler.createRootfs(configCustomPath);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'arm64',
        'bookworm',
        '/custom/path',
      ]);
    });

    it('should handle package installation without sudo', async () => {
      vi.mocked(system.getSudo).mockResolvedValue('');

      const configWithPackages = {
        ...baseConfig,
        packages: ['vim'],
      };

      await handler.createRootfs(configWithPackages);

      // Should call chroot without sudo wrapper
      expect(exec.execWithOutput).toHaveBeenCalledWith('chroot', [
        '/home/user/rootfs',
        'apt-get',
        'update',
      ]);

      expect(exec.execWithOutput).toHaveBeenCalledWith('chroot', [
        '/home/user/rootfs',
        'apt-get',
        'install',
        '-y',
        '--no-install-recommends',
        'vim',
      ]);
    });

    it('should propagate errors from debootstrap', async () => {
      vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('Debootstrap failed'));

      await expect(handler.createRootfs(baseConfig)).rejects.toThrow('Debootstrap failed');
    });

    it('should propagate errors from package installation', async () => {
      const configWithPackages = {
        ...baseConfig,
        packages: ['curl'],
      };

      vi.mocked(exec.execWithOutput)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // debootstrap succeeds
        .mockRejectedValue(new Error('Package install failed')); // apt-get fails

      await expect(handler.createRootfs(configWithPackages)).rejects.toThrow('Package install failed');
    });

    it('should handle single package', async () => {
      const configWithSinglePackage = {
        ...baseConfig,
        packages: ['curl'],
      };

      await handler.createRootfs(configWithSinglePackage);

      expect(core.info).toHaveBeenCalledWith('Installing additional packages: curl');
    });

    it('should handle ubuntu config', async () => {
      const ubuntuConfig = {
        ...baseConfig,
        name: 'ubuntu',
        version: 'jammy',
      };

      await handler.createRootfs(ubuntuConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'debootstrap',
        '--variant=minbase',
        '--arch',
        'arm64',
        'jammy',
        '/home/user/rootfs',
      ]);
    });
  });
});
