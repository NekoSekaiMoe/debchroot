import { commandExists, execWithOutput } from './exec';

export type PackageManager = 'apt' | 'dnf' | 'zypper' | 'pacman' | 'unknown';

export async function detectPackageManager(): Promise<PackageManager> {
	if (await commandExists('apt-get')) return 'apt';
	if (await commandExists('dnf')) return 'dnf';
	if (await commandExists('zypper')) return 'zypper';
	if (await commandExists('pacman')) return 'pacman';
	return 'unknown';
}

export async function getSudo(): Promise<string> {
	const { stdout } = await execWithOutput('id', ['-u']);
	return stdout.trim() === '0' ? '' : 'sudo';
}

export async function installPackages(pm: PackageManager, packages: string[]): Promise<void> {
	const sudo = await getSudo();

	switch (pm) {
		case 'apt':
			await execWithOutput(sudo || 'apt-get', ['apt-get', 'update'].filter(Boolean));
			await execWithOutput(
				sudo || 'apt-get',
				['apt-get', 'install', '--no-install-recommends', '-y', ...packages].filter(Boolean)
			);
			break;
		case 'dnf':
			await execWithOutput(sudo || 'dnf', ['dnf', 'install', '-y', ...packages].filter(Boolean));
			break;
		case 'zypper':
			await execWithOutput(
				sudo || 'zypper',
				['zypper', 'install', '-y', ...packages].filter(Boolean)
			);
			break;
		case 'pacman':
			await execWithOutput(sudo || 'pacman', ['pacman', '-Sy', ...packages].filter(Boolean));
			break;
		default:
			throw new Error(`Unsupported package manager: ${pm}`);
	}
}

export async function isCrossArchitecture(arch: string): Promise<boolean> {
	const { stdout } = await execWithOutput('uname', ['-m']);
	const hostArch = stdout.trim();

	// Map common arch names
	const archMap: Record<string, string> = {
		x86_64: 'amd64',
		aarch64: 'arm64',
		armv7l: 'armhf',
		i386: 'i386',
		amd64: 'amd64',
		arm64: 'arm64',
		armhf: 'armhf',
	};

	return archMap[hostArch] !== arch && hostArch !== arch;
}
