import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exec from '../utils/exec';
import * as system from '../utils/system';
import { ArchHandler, setPackageManager } from './arch';

vi.mock('../utils/exec');
vi.mock('../utils/system');

describe('ArchHandler', () => {
	let handler: ArchHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ArchHandler();
	});

	describe('name', () => {
		it('should have correct name', () => {
			expect(handler.name).toBe('Arch Linux');
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

		it('should install arch-install-scripts, qemu-user-static and pacman-package-manager with apt', async () => {
			await handler.installTools('apt');

			expect(system.installPackages).toHaveBeenCalledWith('apt', [
				'arch-install-scripts',
				'qemu-user-static',
				'pacman-package-manager',
			]);
		});

		it('should install arch-install-scripts, qemu-user-static and pacman-package-manager with dnf', async () => {
			await handler.installTools('dnf');

			expect(system.installPackages).toHaveBeenCalledWith('dnf', [
				'arch-install-scripts',
				'qemu-user-static',
				'pacman-package-manager',
			]);
		});

		it('should install arch-install-scripts, qemu-user-static and pacman-package-manager with zypper', async () => {
			await handler.installTools('zypper');

			expect(system.installPackages).toHaveBeenCalledWith('zypper', [
				'arch-install-scripts',
				'qemu-user-static',
				'pacman-package-manager',
			]);
		});

		it('should install arch-install-scripts, qemu-user-static and pacman-package-manager with pacman', async () => {
			await handler.installTools('pacman');

			expect(system.installPackages).toHaveBeenCalledWith('pacman', [
				'arch-install-scripts',
				'qemu-user-static',
				'pacman-package-manager',
			]);
		});

		it('should propagate errors from installPackages', async () => {
			vi.mocked(system.installPackages).mockRejectedValue(new Error('Install failed'));

			await expect(handler.installTools('apt')).rejects.toThrow('Install failed');
		});
	});

	describe('createRootfs', () => {
		const baseConfig = {
			name: 'arch',
			arch: 'arm64',
			version: 'base',
			packages: [] as string[],
			rootfs: '/home/user/rootfs',
		};

		beforeEach(() => {
			vi.mocked(system.getSudo).mockResolvedValue('sudo');
			vi.mocked(system.installPackages).mockResolvedValue(undefined);
			vi.mocked(exec.execWithOutput).mockResolvedValue({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});
		});

		it('should install archlinux-keyring first', async () => {
			await handler.createRootfs(baseConfig);

			expect(system.installPackages).toHaveBeenCalledWith('apt', ['archlinux-keyring']);
		});

		it('should create rootfs with sudo and correct arguments', async () => {
			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'pacstrap',
				'-c',
				'/home/user/rootfs',
				'base',
			]);
		});

		it('should create rootfs without sudo when running as root', async () => {
			vi.mocked(system.getSudo).mockResolvedValue('');

			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('pacstrap', [
				'-c',
				'/home/user/rootfs',
				'base',
			]);
		});

		it('should install additional packages when specified', async () => {
			const configWithPackages = {
				...baseConfig,
				packages: ['curl', 'git'],
			};

			await handler.createRootfs(configWithPackages);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'pacstrap',
				'-c',
				'/home/user/rootfs',
				'base',
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
				'pacstrap',
				'-c',
				'/home/user/rootfs',
				'base',
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
				'pacstrap',
				'-c',
				'/custom/path',
				'base',
			]);
		});

		it('should propagate errors from installPackages (archlinux-keyring)', async () => {
			vi.mocked(system.installPackages).mockRejectedValue(new Error('Keyring install failed'));

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('Keyring install failed');
		});

		it('should propagate errors from pacstrap', async () => {
			vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('Pacstrap failed'));

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('Pacstrap failed');
		});

		it('should handle empty packages array', async () => {
			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				'pacstrap',
				'-c',
				'/home/user/rootfs',
				'base',
			]);
		});
	});

	describe('setPackageManager', () => {
		it('should be exported', () => {
			expect(setPackageManager).toBeDefined();
			expect(typeof setPackageManager).toBe('function');
		});

		it('should set package manager without error', () => {
			expect(() => setPackageManager('apt')).not.toThrow();
			expect(() => setPackageManager('dnf')).not.toThrow();
			expect(() => setPackageManager('zypper')).not.toThrow();
			expect(() => setPackageManager('pacman')).not.toThrow();
		});
	});
});
