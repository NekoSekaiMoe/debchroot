import * as fs from 'node:fs';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exec from '../utils/exec';
import * as system from '../utils/system';
import { AlpineHandler } from './alpine';

vi.mock('../utils/exec');
vi.mock('../utils/system');
vi.mock('@actions/core');
vi.mock('@actions/tool-cache');
vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		promises: {
			chmod: vi.fn(),
		},
	};
});

describe('AlpineHandler', () => {
	let handler: AlpineHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new AlpineHandler();
	});

	describe('name', () => {
		it('should have correct name', () => {
			expect(handler.name).toBe('Alpine Linux');
		});
	});

	describe('validateEnvironment', () => {
		it('should resolve without error', async () => {
			await expect(handler.validateEnvironment()).resolves.toBeUndefined();
		});
	});

	describe('installTools', () => {
		const mockDownloadPath = '/tmp/alpine-make-rootfs';

		beforeEach(() => {
			vi.mocked(system.installPackages).mockResolvedValue(undefined);
			vi.mocked(tc.downloadTool).mockResolvedValue(mockDownloadPath);
			vi.mocked(fs.promises.chmod).mockResolvedValue(undefined);
		});

		it('should install wget and qemu-user-static with apt', async () => {
			await handler.installTools('apt');

			expect(system.installPackages).toHaveBeenCalledWith('apt', ['wget', 'qemu-user-static']);
		});

		it('should install wget and qemu-user-static with dnf', async () => {
			await handler.installTools('dnf');

			expect(system.installPackages).toHaveBeenCalledWith('dnf', ['wget', 'qemu-user-static']);
		});

		it('should install wget and qemu-user-static with zypper', async () => {
			await handler.installTools('zypper');

			expect(system.installPackages).toHaveBeenCalledWith('zypper', ['wget', 'qemu-user-static']);
		});

		it('should install wget and qemu-user-static with pacman', async () => {
			await handler.installTools('pacman');

			expect(system.installPackages).toHaveBeenCalledWith('pacman', ['wget', 'qemu-user-static']);
		});

		it('should download alpine-make-rootfs script', async () => {
			await handler.installTools('apt');

			expect(tc.downloadTool).toHaveBeenCalledWith(
				'https://raw.githubusercontent.com/alpinelinux/alpine-make-rootfs/v0.8.1/alpine-make-rootfs'
			);
		});

		it('should make downloaded script executable', async () => {
			await handler.installTools('apt');

			expect(fs.promises.chmod).toHaveBeenCalledWith(mockDownloadPath, 0o755);
		});

		it('should log download progress', async () => {
			await handler.installTools('apt');

			expect(core.info).toHaveBeenCalledWith('Downloading alpine-make-rootfs v0.8.1...');
		});

		it('should propagate errors from installPackages', async () => {
			vi.mocked(system.installPackages).mockRejectedValue(new Error('Install failed'));

			await expect(handler.installTools('apt')).rejects.toThrow('Install failed');
		});

		it('should propagate errors from downloadTool', async () => {
			vi.mocked(tc.downloadTool).mockRejectedValue(new Error('Download failed'));

			await expect(handler.installTools('apt')).rejects.toThrow('Download failed');
		});

		it('should propagate errors from chmod', async () => {
			vi.mocked(fs.promises.chmod).mockRejectedValue(new Error('Chmod failed'));

			await expect(handler.installTools('apt')).rejects.toThrow('Chmod failed');
		});
	});

	describe('createRootfs', () => {
		const mockDownloadPath = '/tmp/alpine-make-rootfs';
		const baseConfig = {
			name: 'alpine',
			arch: 'arm64',
			version: 'v3.19',
			packages: [] as string[],
			rootfs: '/home/user/rootfs',
		};

		beforeEach(async () => {
			vi.mocked(system.getSudo).mockResolvedValue('sudo');
			vi.mocked(exec.execWithOutput).mockResolvedValue({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});
			vi.mocked(tc.downloadTool).mockResolvedValue(mockDownloadPath);
			vi.mocked(fs.promises.chmod).mockResolvedValue(undefined);
			vi.mocked(system.installPackages).mockResolvedValue(undefined);

			// First install tools to set up the download path
			await handler.installTools('apt');
			vi.clearAllMocks();
			vi.mocked(system.getSudo).mockResolvedValue('sudo');
			vi.mocked(exec.execWithOutput).mockResolvedValue({
				exitCode: 0,
				stdout: '',
				stderr: '',
			});
		});

		it('should throw error if alpine-make-rootfs not downloaded', async () => {
			// Create new handler without installing tools
			const newHandler = new AlpineHandler();

			await expect(newHandler.createRootfs(baseConfig)).rejects.toThrow(
				'alpine-make-rootfs not downloaded'
			);
		});

		it('should create rootfs with sudo and correct arguments', async () => {
			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				mockDownloadPath,
				'--branch',
				'v3.19',
				'/home/user/rootfs',
			]);
		});

		it('should create rootfs without sudo when running as root', async () => {
			vi.mocked(system.getSudo).mockResolvedValue('');

			await handler.createRootfs(baseConfig);

			expect(exec.execWithOutput).toHaveBeenCalledWith(mockDownloadPath, [
				'--branch',
				'v3.19',
				'/home/user/rootfs',
			]);
		});

		it('should include packages when specified', async () => {
			const configWithPackages = {
				...baseConfig,
				packages: ['curl', 'git'],
			};

			await handler.createRootfs(configWithPackages);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				mockDownloadPath,
				'--branch',
				'v3.19',
				'--packages',
				'curl git',
				'/home/user/rootfs',
			]);
		});

		it('should include single package when specified', async () => {
			const configWithSinglePackage = {
				...baseConfig,
				packages: ['vim'],
			};

			await handler.createRootfs(configWithSinglePackage);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				mockDownloadPath,
				'--branch',
				'v3.19',
				'--packages',
				'vim',
				'/home/user/rootfs',
			]);
		});

		it('should handle different versions', async () => {
			const configEdge = {
				...baseConfig,
				version: 'edge',
			};

			await handler.createRootfs(configEdge);

			expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
				mockDownloadPath,
				'--branch',
				'edge',
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
				mockDownloadPath,
				'--branch',
				'v3.19',
				'/custom/path',
			]);
		});

		it('should propagate errors from execWithOutput', async () => {
			vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('Rootfs creation failed'));

			await expect(handler.createRootfs(baseConfig)).rejects.toThrow('Rootfs creation failed');
		});

		it('should handle empty packages array', async () => {
			await handler.createRootfs(baseConfig);

			const calls = vi.mocked(exec.execWithOutput).mock.calls;
			const args = calls[0][1] as string[];
			expect(args).not.toContain('--packages');
		});

		it('should handle packages without sudo', async () => {
			vi.mocked(system.getSudo).mockResolvedValue('');

			const configWithPackages = {
				...baseConfig,
				packages: ['curl'],
			};

			await handler.createRootfs(configWithPackages);

			expect(exec.execWithOutput).toHaveBeenCalledWith(mockDownloadPath, [
				'--branch',
				'v3.19',
				'--packages',
				'curl',
				'/home/user/rootfs',
			]);
		});
	});
});
