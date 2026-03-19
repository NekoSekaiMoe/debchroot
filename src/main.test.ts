import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as distros from './distros';
import {
	type AlpineHandler,
	DebianHandler,
	type FedoraHandler,
	type OpenSUSEHandler,
} from './distros';
import { run } from './main';
import * as debsh from './utils/debsh';
import * as system from './utils/system';

// Mock all dependencies
vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('./utils/system');
vi.mock('./utils/debsh');
vi.mock('./distros');

describe('main', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv, HOME: '/home/user' };

		// Default mocks
		vi.mocked(core.getInput).mockImplementation((name: string) => {
			const defaults: Record<string, string> = {
				distro: 'debian',
				arch: 'arm64',
				version: 'bookworm',
				packages: '',
			};
			return defaults[name] || '';
		});

		vi.mocked(system.detectPackageManager).mockResolvedValue('apt');
		vi.mocked(distros.getDistroHandler).mockReturnValue(new DebianHandler());

		// Mock handler methods
		const mockHandler = {
			name: 'Debian/Ubuntu',
			validateEnvironment: vi.fn().mockResolvedValue(undefined),
			installTools: vi.fn().mockResolvedValue(undefined),
			createRootfs: vi.fn().mockResolvedValue(undefined),
		};
		vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

		vi.mocked(debsh.createDebsh).mockResolvedValue(undefined);
		vi.mocked(exec.exec).mockResolvedValue(0);
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('input handling', () => {
		it('should use default values when inputs are empty', async () => {
			await run();

			expect(core.getInput).toHaveBeenCalledWith('distro');
			expect(core.getInput).toHaveBeenCalledWith('arch');
			expect(core.getInput).toHaveBeenCalledWith('version');
			expect(core.getInput).toHaveBeenCalledWith('packages');
		});

		it('should parse custom distro input', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'distro') return 'alpine';
				return '';
			});

			const mockHandler = {
				name: 'Alpine Linux',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as AlpineHandler);

			await run();

			expect(distros.getDistroHandler).toHaveBeenCalledWith('alpine');
			expect(core.info).toHaveBeenCalledWith('Creating alpine rootfs...');
		});

		it('should parse custom arch input', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'arch') return 'amd64';
				return '';
			});

			await run();

			expect(core.info).toHaveBeenCalledWith('  Architecture: amd64');
		});

		it('should parse custom version input', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'version') return 'bullseye';
				return '';
			});

			await run();

			expect(core.info).toHaveBeenCalledWith('  Version: bullseye');
		});

		it('should parse packages input and split by whitespace', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'packages') return 'curl git vim';
				return '';
			});

			await run();

			expect(core.info).toHaveBeenCalledWith('  Additional packages: curl git vim');
		});

		it('should handle empty packages input', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'packages') return '';
				return '';
			});

			await run();

			const infoCalls = vi.mocked(core.info).mock.calls;
			const packagesCall = infoCalls.find((call) => call[0]?.includes('Additional packages'));
			expect(packagesCall).toBeUndefined();
		});

		it('should handle packages with extra whitespace', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'packages') return '  curl   git  ';
				return '';
			});

			await run();

			expect(core.info).toHaveBeenCalledWith('  Additional packages: curl git');
		});
	});

	describe('package manager detection', () => {
		it('should detect package manager successfully', async () => {
			vi.mocked(system.detectPackageManager).mockResolvedValue('apt');

			await run();

			expect(system.detectPackageManager).toHaveBeenCalled();
			expect(core.info).toHaveBeenCalledWith('Detected package manager: apt');
		});

		it('should fail when package manager is unknown', async () => {
			vi.mocked(system.detectPackageManager).mockResolvedValue('unknown');

			await run();

			expect(core.setFailed).toHaveBeenCalledWith(
				'Unsupported package manager. Requires: apt, dnf, zypper, or pacman'
			);
		});

		it('should support dnf package manager', async () => {
			vi.mocked(system.detectPackageManager).mockResolvedValue('dnf');

			await run();

			expect(core.info).toHaveBeenCalledWith('Detected package manager: dnf');
		});

		it('should support zypper package manager', async () => {
			vi.mocked(system.detectPackageManager).mockResolvedValue('zypper');

			await run();

			expect(core.info).toHaveBeenCalledWith('Detected package manager: zypper');
		});

		it('should support pacman package manager', async () => {
			vi.mocked(system.detectPackageManager).mockResolvedValue('pacman');

			await run();

			expect(core.info).toHaveBeenCalledWith('Detected package manager: pacman');
		});
	});

	describe('handler selection', () => {
		it('should get handler for debian', async () => {
			await run();

			expect(distros.getDistroHandler).toHaveBeenCalledWith('debian');
		});

		it('should get handler for arch', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				if (name === 'distro') return 'arch';
				return '';
			});

			await run();

			expect(distros.getDistroHandler).toHaveBeenCalledWith('arch');
		});

		it('should log handler name', async () => {
			const mockHandler = {
				name: 'Test Handler',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(core.info).toHaveBeenCalledWith('Using Test Handler handler');
		});
	});

	describe('environment validation', () => {
		it('should validate environment', async () => {
			const mockValidate = vi.fn().mockResolvedValue(undefined);
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: mockValidate,
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(core.startGroup).toHaveBeenCalledWith('Validating environment');
			expect(mockValidate).toHaveBeenCalled();
			expect(core.endGroup).toHaveBeenCalled();
		});

		it('should fail when validation fails', async () => {
			const mockValidate = vi.fn().mockRejectedValue(new Error('Validation failed'));
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: mockValidate,
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Validation failed');
		});
	});

	describe('tool installation', () => {
		it('should install tools with detected package manager', async () => {
			const mockInstallTools = vi.fn().mockResolvedValue(undefined);
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: mockInstallTools,
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);
			vi.mocked(system.detectPackageManager).mockResolvedValue('apt');

			await run();

			expect(core.startGroup).toHaveBeenCalledWith('Installing tools');
			expect(mockInstallTools).toHaveBeenCalledWith('apt');
			expect(core.endGroup).toHaveBeenCalled();
		});

		it('should fail when tool installation fails', async () => {
			const mockInstallTools = vi.fn().mockRejectedValue(new Error('Install failed'));
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: mockInstallTools,
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Install failed');
		});
	});

	describe('rootfs creation', () => {
		it('should create rootfs with correct config', async () => {
			const mockCreateRootfs = vi.fn().mockResolvedValue(undefined);
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: mockCreateRootfs,
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			vi.mocked(core.getInput).mockImplementation((name: string) => {
				const inputs: Record<string, string> = {
					distro: 'debian',
					arch: 'arm64',
					version: 'bookworm',
					packages: 'curl git',
				};
				return inputs[name] || '';
			});

			await run();

			expect(core.startGroup).toHaveBeenCalledWith('Creating rootfs');
			expect(mockCreateRootfs).toHaveBeenCalledWith({
				name: 'debian',
				arch: 'arm64',
				version: 'bookworm',
				packages: ['curl', 'git'],
				rootfs: '/home/user/rootfs',
			});
			expect(core.endGroup).toHaveBeenCalled();
		});

		it('should create rootfs with empty packages', async () => {
			const mockCreateRootfs = vi.fn().mockResolvedValue(undefined);
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: mockCreateRootfs,
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(mockCreateRootfs).toHaveBeenCalledWith({
				name: 'debian',
				arch: 'arm64',
				version: 'bookworm',
				packages: [],
				rootfs: '/home/user/rootfs',
			});
		});

		it('should fail when rootfs creation fails', async () => {
			const mockCreateRootfs = vi.fn().mockRejectedValue(new Error('Rootfs failed'));
			const mockHandler = {
				name: 'Debian/Ubuntu',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: mockCreateRootfs,
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as DebianHandler);

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Rootfs failed');
		});
	});

	describe('debsh creation', () => {
		it('should create debsh script', async () => {
			await run();

			expect(core.startGroup).toHaveBeenCalledWith('Creating debsh');
			expect(debsh.createDebsh).toHaveBeenCalledWith('/home/user/rootfs');
			expect(core.endGroup).toHaveBeenCalled();
		});

		it('should fail when debsh creation fails', async () => {
			vi.mocked(debsh.createDebsh).mockRejectedValue(new Error('Debsh failed'));

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Debsh failed');
		});
	});

	describe('chroot testing', () => {
		it('should test chroot with uname -a', async () => {
			await run();

			expect(core.startGroup).toHaveBeenCalledWith('Testing chroot');
			expect(exec.exec).toHaveBeenCalledWith('debsh', ['uname', '-a']);
			expect(core.endGroup).toHaveBeenCalled();
		});

		it('should fail when chroot test fails', async () => {
			vi.mocked(exec.exec).mockRejectedValue(new Error('Chroot test failed'));

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Chroot test failed');
		});
	});

	describe('output setting', () => {
		it('should set rootfs output', async () => {
			await run();

			expect(core.setOutput).toHaveBeenCalledWith('rootfs', '/home/user/rootfs');
		});

		it('should log success message', async () => {
			await run();

			expect(core.info).toHaveBeenCalledWith(
				'✅ Successfully created debian rootfs at /home/user/rootfs'
			);
		});
	});

	describe('error handling', () => {
		it('should handle string errors', async () => {
			vi.mocked(system.detectPackageManager).mockImplementation(() => {
				throw 'String error';
			});

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('String error');
		});

		it('should handle Error objects', async () => {
			vi.mocked(system.detectPackageManager).mockImplementation(() => {
				throw new Error('Error object');
			});

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('Error object');
		});

		it('should handle errors with no message', async () => {
			vi.mocked(system.detectPackageManager).mockImplementation(() => {
				throw {};
			});

			await run();

			expect(core.setFailed).toHaveBeenCalledWith('[object Object]');
		});
	});

	describe('full workflow with different distros', () => {
		it('should work with alpine', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				const inputs: Record<string, string> = {
					distro: 'alpine',
					arch: 'arm64',
					version: 'v3.19',
					packages: '',
				};
				return inputs[name] || '';
			});

			const mockHandler = {
				name: 'Alpine Linux',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as AlpineHandler);

			await run();

			expect(core.info).toHaveBeenCalledWith('Creating alpine rootfs...');
			expect(core.info).toHaveBeenCalledWith(
				'✅ Successfully created alpine rootfs at /home/user/rootfs'
			);
		});

		it('should work with fedora', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				const inputs: Record<string, string> = {
					distro: 'fedora',
					arch: 'amd64',
					version: '40',
					packages: 'curl',
				};
				return inputs[name] || '';
			});

			const mockHandler = {
				name: 'Fedora',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(mockHandler as unknown as FedoraHandler);

			await run();

			expect(core.info).toHaveBeenCalledWith('Creating fedora rootfs...');
			expect(core.info).toHaveBeenCalledWith('  Additional packages: curl');
		});

		it('should work with opensuse', async () => {
			vi.mocked(core.getInput).mockImplementation((name: string) => {
				const inputs: Record<string, string> = {
					distro: 'opensuse',
					arch: 'arm64',
					version: 'tumbleweed',
					packages: '',
				};
				return inputs[name] || '';
			});

			const mockHandler = {
				name: 'openSUSE',
				validateEnvironment: vi.fn().mockResolvedValue(undefined),
				installTools: vi.fn().mockResolvedValue(undefined),
				createRootfs: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(distros.getDistroHandler).mockReturnValue(
				mockHandler as unknown as OpenSUSEHandler
			);

			await run();

			expect(core.info).toHaveBeenCalledWith('Creating opensuse rootfs...');
		});
	});

	describe('HOME environment variable', () => {
		it('should use HOME env var for rootfs path', async () => {
			process.env.HOME = '/custom/home';

			await run();

			expect(debsh.createDebsh).toHaveBeenCalledWith('/custom/home/rootfs');
			expect(core.setOutput).toHaveBeenCalledWith('rootfs', '/custom/home/rootfs');
		});
	});
});
