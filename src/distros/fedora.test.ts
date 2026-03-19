import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exec from '../utils/exec';
import * as system from '../utils/system';
import { FedoraHandler } from './fedora';

vi.mock('../utils/exec');
vi.mock('../utils/system');
vi.mock('@actions/core');

describe('FedoraHandler', () => {
	let handler: FedoraHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new FedoraHandler();
	});

	describe('name', () => {
		it('should have correct name', () => {
			expect(handler.name).toBe('Fedora');
		});
	});

	describe('validateEnvironment', () => {
		it('should show warning about experimental support', async () => {
			await handler.validateEnvironment();

			expect(core.warning).toHaveBeenCalledWith(
				'Fedora support is experimental and may not work on all hosts'
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

		it('should install dnf and qemu-user-static with apt', async () => {
			await handler.installTools('apt');

			expect(system.installPackages).toHaveBeenCalledWith('apt', ['dnf', 'qemu-user-static']);
		});

		it('should show warning when installing on apt-based host', async () => {
			await handler.installTools('apt');

			expect(core.warning).toHaveBeenCalledWith(
				'Installing Fedora rootfs on Debian-based host requires dnf'
			);
		});

		it('should install dnf and qemu-user-static with dnf', async () => {
			await handler.installTools('dnf');

			expect(system.installPackages).toHaveBeenCalledWith('dnf', ['dnf', 'qemu-user-static']);
			expect(core.warning).not.toHaveBeenCalledWith(
				'Installing Fedora rootfs on Debian-based host requires dnf'
			);
		});

		it('should install dnf and qemu-user-static with zypper', async () => {
			await handler.installTools('zypper');

			expect(system.installPackages).toHaveBeenCalledWith('zypper', ['dnf', 'qemu-user-static']);
		});

		it('should install dnf and qemu-user-static with pacman', async () => {
			await handler.installTools('pacman');

			expect(system.installPackages).toHaveBeenCalledWith('pacman', ['dnf', 'qemu-user-static']);
		});

		it('should propagate errors from installPackages', async () => {
			vi.mocked(system.installPackages).mockRejectedValue(new Error('Install failed'));

			await expect(handler.installTools('apt')).rejects.toThrow('Install failed');
		});
	});

	describe('createRootfs', () => {
		const baseConfig = {
			name: 'fedora',
			arch: 'arm64',
			version: '40',
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

		it('should install base system with dnf using sudo', async () => {
			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'dnf',
				'--installroot=/home/user/rootfs',
				'--releasever=40',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
			]);
		});

		it('should install base system without sudo when root', async () => {
			vi.mocked(system.getSudo).mockResolvedValue('');

			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('dnf', [
				'--installroot=/home/user/rootfs',
				'--releasever=40',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
			]);
		});

		it('should clean up after installation with sudo', async () => {
			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'dnf',
				'--installroot=/home/user/rootfs',
				'clean',
				'all',
			]);
		});

		it('should clean up after installation without sudo when root', async () => {
			vi.mocked(system.getSudo).mockResolvedValue('');

			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('dnf', [
				'--installroot=/home/user/rootfs',
				'clean',
				'all',
			]);
		});

		it('should install additional packages when specified', async () => {
			const configWithPackages = {
				...baseConfig,
				packages: ['curl', 'git'],
			};

			await handler.createRootfs(configWithPackages);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'dnf',
				'--installroot=/home/user/rootfs',
				'--releasever=40',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
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
				'dnf',
				'--installroot=/home/user/rootfs',
				'--releasever=40',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
				'vim',
			]);
		});

		it('should handle different versions', async () => {
			const configRawhide = {
				...baseConfig,
				version: 'rawhide',
			};

			await handler.createRootfs(configRawhide);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'dnf',
				'--installroot=/home/user/rootfs',
				'--releasever=rawhide',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
			]);
		});

		it('should handle different rootfs paths', async () => {
			const configCustomPath = {
				...baseConfig,
				rootfs: '/custom/path',
			};

			await handler.createRootfs(configCustomPath);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'dnf',
				'--installroot=/custom/path',
				'--releasever=40',
				'--repo=fedora',
				'--repo=updates',
				'--setopt=install_weak_deps=False',
				'install',
				'-y',
				'systemd',
				'dnf',
			]);
		});

		it('should propagate errors from mkdir', async () => {
			vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('mkdir failed'));

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('mkdir failed');
		});

		it('should propagate errors from dnf install', async () => {
			vi.mocked(exec.execWithOutput)
				.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // mkdir succeeds
				.mockRejectedValue(new Error('dnf install failed')); // dnf fails

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('dnf install failed');
		});

		it('should propagate errors from dnf clean', async () => {
			vi.mocked(exec.execWithOutput)
				.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // mkdir
				.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // dnf install
				.mockRejectedValue(new Error('dnf clean failed')); // dnf clean fails

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('dnf clean failed');
		});

		it('should handle empty packages array', async () => {
			await handler.createRootfs(baseConfig);

			const installCall = vi
				.mocked(exec.execWithOutput)
				.mock.calls.find((call) => call[1]?.[0] === 'dnf' && call[1]?.[6] === 'install');
			expect(installCall).toBeDefined();
			const args = installCall?.[1] as string[];
			expect(args).toContain('systemd');
			expect(args).toContain('dnf');
			expect(args).not.toContain('curl');
		});
	});
});
