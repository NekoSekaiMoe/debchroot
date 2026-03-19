import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSUSEHandler } from './opensuse';
import * as exec from '../utils/exec';
import * as system from '../utils/system';
import * as core from '@actions/core';

vi.mock('../utils/exec');
vi.mock('../utils/system');
vi.mock('@actions/core');

describe('OpenSUSEHandler', () => {
  let handler: OpenSUSEHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OpenSUSEHandler();
  });

  describe('name', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('openSUSE');
    });
  });

  describe('validateEnvironment', () => {
    it('should show warning about experimental support', async () => {
      await handler.validateEnvironment();

      expect(core.warning).toHaveBeenCalledWith(
        'openSUSE support is experimental and may not work on all hosts'
      );
    });

    it('should resolve after showing warning', async () => {
      await expect(handler.validateEnvironment()).resolves.toBeUndefined();
    });
  });

  describe('installTools', () => {
    beforeEach(() => {
      vi.mocked(system.installPackages).mockResolvedValue(undefined);
    });

    it('should install zypper and qemu-user-static with apt', async () => {
      await handler.installTools('apt');

      expect(system.installPackages).toHaveBeenCalledWith('apt', [
        'zypper',
        'qemu-user-static',
      ]);
    });

    it('should install zypper and qemu-user-static with dnf', async () => {
      await handler.installTools('dnf');

      expect(system.installPackages).toHaveBeenCalledWith('dnf', [
        'zypper',
        'qemu-user-static',
      ]);
    });

    it('should install zypper and qemu-user-static with zypper', async () => {
      await handler.installTools('zypper');

      expect(system.installPackages).toHaveBeenCalledWith('zypper', [
        'zypper',
        'qemu-user-static',
      ]);
    });

    it('should install zypper and qemu-user-static with pacman', async () => {
      await handler.installTools('pacman');

      expect(system.installPackages).toHaveBeenCalledWith('pacman', [
        'zypper',
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
      name: 'opensuse',
      arch: 'arm64',
      version: 'tumbleweed',
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

    it('should create rootfs directory with sudo', async () => {
      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'mkdir',
        '-p',
        '/home/user/rootfs',
      ]);
    });

    it('should create rootfs directory without sudo when root', async () => {
      vi.mocked(system.getSudo).mockResolvedValue('');

      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('mkdir', [
        'mkdir',
        '-p',
        '/home/user/rootfs',
      ]);
    });

    describe('tumbleweed', () => {
      it('should add tumbleweed repo with sudo', async () => {
        await handler.createRootfs(baseConfig);

        expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
          'zypper',
          '--root=/home/user/rootfs',
          'addrepo',
          '-f',
          'https://download.opensuse.org/tumbleweed/repo/oss/',
          'repo-oss',
        ]);
      });

      it('should add tumbleweed repo without sudo when root', async () => {
        vi.mocked(system.getSudo).mockResolvedValue('');

        await handler.createRootfs(baseConfig);

        expect(exec.execWithOutput).toHaveBeenCalledWith('zypper', [
          '--root=/home/user/rootfs',
          'addrepo',
          '-f',
          'https://download.opensuse.org/tumbleweed/repo/oss/',
          'repo-oss',
        ]);
      });
    });

    describe('leap version', () => {
      it('should add leap repo with leap/ prefix format', async () => {
        const configLeap = {
          ...baseConfig,
          version: 'leap/15.5',
        };

        await handler.createRootfs(configLeap);

        expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
          'zypper',
          '--root=/home/user/rootfs',
          'addrepo',
          '-f',
          'https://download.opensuse.org/distribution/leap/15.5/repo/oss/',
          'repo-oss',
        ]);
      });

      it('should add leap repo with direct version number', async () => {
        const configLeap = {
          ...baseConfig,
          version: '15.5',
        };

        await handler.createRootfs(configLeap);

        expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
          'zypper',
          '--root=/home/user/rootfs',
          'addrepo',
          '-f',
          'https://download.opensuse.org/distribution/leap/15.5/repo/oss/',
          'repo-oss',
        ]);
      });
    });

    it('should install minimal base pattern with sudo', async () => {
      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'zypper',
        '--root=/home/user/rootfs',
        'install',
        '-y',
        '--no-recommends',
        'patterns-base-minimal_base',
      ]);
    });

    it('should install minimal base pattern without sudo when root', async () => {
      vi.mocked(system.getSudo).mockResolvedValue('');

      await handler.createRootfs(baseConfig);

      expect(exec.execWithOutput).toHaveBeenCalledWith('zypper', [
        '--root=/home/user/rootfs',
        'install',
        '-y',
        '--no-recommends',
        'patterns-base-minimal_base',
      ]);
    });

    it('should install additional packages when specified', async () => {
      const configWithPackages = {
        ...baseConfig,
        packages: ['curl', 'git'],
      };

      await handler.createRootfs(configWithPackages);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'zypper',
        '--root=/home/user/rootfs',
        'install',
        '-y',
        '--no-recommends',
        'patterns-base-minimal_base',
        'curl',
        'git',
      ]);
    });

    it('should handle single additional package', async () => {
      const configWithSinglePackage = {
        ...baseConfig,
        packages: ['vim'],
      };

      await handler.createRootfs(configWithSinglePackage);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'zypper',
        '--root=/home/user/rootfs',
        'install',
        '-y',
        '--no-recommends',
        'patterns-base-minimal_base',
        'vim',
      ]);
    });

    it('should handle different rootfs paths', async () => {
      const configCustomPath = {
        ...baseConfig,
        rootfs: '/custom/path',
      };

      await handler.createRootfs(configCustomPath);

      expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
        'zypper',
        '--root=/custom/path',
        'addrepo',
        '-f',
        'https://download.opensuse.org/tumbleweed/repo/oss/',
        'repo-oss',
      ]);
    });

    it('should propagate errors from mkdir', async () => {
      vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('mkdir failed'));

      await expect(handler.createRootfs(baseConfig)).rejects.toThrow('mkdir failed');
    });

    it('should propagate errors from zypper addrepo', async () => {
      vi.mocked(exec.execWithOutput)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // mkdir succeeds
        .mockRejectedValue(new Error('addrepo failed')); // addrepo fails

      await expect(handler.createRootfs(baseConfig)).rejects.toThrow('addrepo failed');
    });

    it('should propagate errors from zypper install', async () => {
      vi.mocked(exec.execWithOutput)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // mkdir
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // addrepo
        .mockRejectedValue(new Error('zypper install failed')); // install fails

      await expect(handler.createRootfs(baseConfig)).rejects.toThrow('zypper install failed');
    });

    it('should handle empty packages array', async () => {
      await handler.createRootfs(baseConfig);

      const installCall = vi.mocked(exec.execWithOutput).mock.calls.find(
        (call) =>
          call[1]?.[0] === 'zypper' &&
          call[1]?.[2] === 'install'
      );
      expect(installCall).toBeDefined();
      const args = installCall![1] as string[];
      expect(args).toContain('patterns-base-minimal_base');
      expect(args).not.toContain('curl');
    });
  });
});
