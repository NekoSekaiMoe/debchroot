import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exec from './exec';
import {
	detectPackageManager,
	getSudo,
	installPackages,
	isCrossArchitecture,
	type PackageManager,
} from './system';

vi.mock('./exec');

describe('detectPackageManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return apt when apt-get exists', async () => {
		vi.mocked(exec.commandExists).mockImplementation(async (cmd) => cmd === 'apt-get');

		const result = await detectPackageManager();

		expect(result).toBe('apt');
		expect(exec.commandExists).toHaveBeenCalledWith('apt-get');
	});

	it('should return dnf when dnf exists', async () => {
		vi.mocked(exec.commandExists).mockImplementation(async (cmd) => cmd === 'dnf');

		const result = await detectPackageManager();

		expect(result).toBe('dnf');
	});

	it('should return zypper when zypper exists', async () => {
		vi.mocked(exec.commandExists).mockImplementation(async (cmd) => cmd === 'zypper');

		const result = await detectPackageManager();

		expect(result).toBe('zypper');
	});

	it('should return pacman when pacman exists', async () => {
		vi.mocked(exec.commandExists).mockImplementation(async (cmd) => cmd === 'pacman');

		const result = await detectPackageManager();

		expect(result).toBe('pacman');
	});

	it('should return unknown when no package manager exists', async () => {
		vi.mocked(exec.commandExists).mockResolvedValue(false);

		const result = await detectPackageManager();

		expect(result).toBe('unknown');
	});

	it('should check package managers in correct order', async () => {
		const commandExistsMock = vi.mocked(exec.commandExists);
		commandExistsMock.mockResolvedValue(false);

		await detectPackageManager();

		expect(commandExistsMock).toHaveBeenNthCalledWith(1, 'apt-get');
		expect(commandExistsMock).toHaveBeenNthCalledWith(2, 'dnf');
		expect(commandExistsMock).toHaveBeenNthCalledWith(3, 'zypper');
		expect(commandExistsMock).toHaveBeenNthCalledWith(4, 'pacman');
	});

	it('should stop checking after finding first package manager', async () => {
		vi.mocked(exec.commandExists).mockImplementation(async (cmd) => cmd === 'dnf');

		await detectPackageManager();

		expect(exec.commandExists).toHaveBeenCalledTimes(2);
		expect(exec.commandExists).toHaveBeenCalledWith('apt-get');
		expect(exec.commandExists).toHaveBeenCalledWith('dnf');
		expect(exec.commandExists).not.toHaveBeenCalledWith('zypper');
	});
});

describe('getSudo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return empty string when running as root (uid=0)', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '0\n',
			stderr: '',
		});

		const result = await getSudo();

		expect(result).toBe('');
		expect(exec.execWithOutput).toHaveBeenCalledWith('id', ['-u']);
	});

	it('should return sudo when not running as root', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '1000\n',
			stderr: '',
		});

		const result = await getSudo();

		expect(result).toBe('sudo');
	});

	it('should handle uid without newline', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '0',
			stderr: '',
		});

		const result = await getSudo();

		expect(result).toBe('');
	});
});

describe('installPackages', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should install packages with apt', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await installPackages('apt', ['curl', 'git']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['apt-get', 'update']);
		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
			'apt-get',
			'install',
			'--no-install-recommends',
			'-y',
			'curl',
			'git',
		]);
	});

	it('should install packages with dnf', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await installPackages('dnf', ['vim']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['dnf', 'install', '-y', 'vim']);
	});

	it('should install packages with zypper', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await installPackages('zypper', ['wget']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['zypper', 'install', '-y', 'wget']);
	});

	it('should install packages with pacman', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await installPackages('pacman', ['base-devel']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['pacman', '-Sy', 'base-devel']);
	});

	it('should throw error for unsupported package manager', async () => {
		await expect(installPackages('unknown' as PackageManager, ['pkg'])).rejects.toThrow(
			'Unsupported package manager: unknown'
		);
	});

	it('should not use sudo when running as root (apt)', async () => {
		vi.mocked(exec.execWithOutput)
			.mockResolvedValueOnce({ exitCode: 0, stdout: '0', stderr: '' }) // getSudo returns ''
			.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

		await installPackages('apt', ['curl']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('apt-get', ['apt-get', 'update']);
	});

	it('should not use sudo when running as root (dnf)', async () => {
		vi.mocked(exec.execWithOutput)
			.mockResolvedValueOnce({ exitCode: 0, stdout: '0', stderr: '' }) // getSudo returns ''
			.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

		await installPackages('dnf', ['vim']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('dnf', ['dnf', 'install', '-y', 'vim']);
	});

	it('should not use sudo when running as root (zypper)', async () => {
		vi.mocked(exec.execWithOutput)
			.mockResolvedValueOnce({ exitCode: 0, stdout: '0', stderr: '' }) // getSudo returns ''
			.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

		await installPackages('zypper', ['wget']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('zypper', ['zypper', 'install', '-y', 'wget']);
	});

	it('should not use sudo when running as root (pacman)', async () => {
		vi.mocked(exec.execWithOutput)
			.mockResolvedValueOnce({ exitCode: 0, stdout: '0', stderr: '' }) // getSudo returns ''
			.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

		await installPackages('pacman', ['base-devel']);

		expect(exec.execWithOutput).toHaveBeenCalledWith('pacman', ['pacman', '-Sy', 'base-devel']);
	});

	it('should handle empty packages array', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await installPackages('apt', []);

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['apt-get', 'update']);
		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
			'apt-get',
			'install',
			'--no-install-recommends',
			'-y',
		]);
	});
});

describe('isCrossArchitecture', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return false when host and target are the same (amd64)', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'x86_64',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(false);
		expect(exec.execWithOutput).toHaveBeenCalledWith('uname', ['-m']);
	});

	it('should return false when host and target are the same (arm64)', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'aarch64\n',
			stderr: '',
		});

		const result = await isCrossArchitecture('arm64');

		expect(result).toBe(false);
	});

	it('should return true for cross-architecture (x86_64 to arm64)', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'x86_64',
			stderr: '',
		});

		const result = await isCrossArchitecture('arm64');

		expect(result).toBe(true);
	});

	it('should return true for cross-architecture (aarch64 to amd64)', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'aarch64',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(true);
	});

	it('should handle armv7l architecture', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'armv7l',
			stderr: '',
		});

		const result = await isCrossArchitecture('armhf');

		expect(result).toBe(false);
	});

	it('should return true for armv7l to amd64', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'armv7l',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(true);
	});

	it('should handle i386 architecture', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'i386',
			stderr: '',
		});

		const result = await isCrossArchitecture('i386');

		expect(result).toBe(false);
	});

	it('should return true for unknown host architecture', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'riscv64',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(true);
	});

	it('should handle direct architecture names without mapping', async () => {
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'amd64',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(false);
	});

	it('should cover branch: archMap matches and hostArch equals target (both false)', async () => {
		// x86_64 -> amd64, comparing to amd64
		// archMap['x86_64'] !== 'amd64' => false
		// 'x86_64' !== 'amd64' => true
		// false && true => false
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'x86_64',
			stderr: '',
		});

		const result = await isCrossArchitecture('amd64');

		expect(result).toBe(false);
	});

	it('should cover branch: archMap matches but hostArch differs (true && true)', async () => {
		// x86_64 -> amd64, comparing to arm64
		// archMap['x86_64'] !== 'arm64' => true
		// 'x86_64' !== 'arm64' => true
		// true && true => true
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'x86_64',
			stderr: '',
		});

		const result = await isCrossArchitecture('arm64');

		expect(result).toBe(true);
	});

	it('should cover branch: direct match with hostArch (both sides equal)', async () => {
		// arm64 in archMap, comparing to arm64
		// archMap['arm64'] !== 'arm64' => false
		// 'arm64' !== 'arm64' => false
		// false && false => false
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: 'arm64',
			stderr: '',
		});

		const result = await isCrossArchitecture('arm64');

		expect(result).toBe(false);
	});
});
