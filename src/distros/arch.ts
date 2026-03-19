import { execWithOutput } from '../utils/exec';
import { getSudo, installPackages, type PackageManager } from '../utils/system';
import type { DistroConfig, DistroHandler } from './base';

export class ArchHandler implements DistroHandler {
	readonly name = 'Arch Linux';

	async validateEnvironment(): Promise<void> {
		// Arch can be created on any Linux with pacstrap
		return;
	}

	async installTools(packageManager: PackageManager): Promise<void> {
		// arch-install-scripts provides pacstrap
		// pacman-package-manager provides pacman command needed by pacstrap
		await installPackages(packageManager, [
			'arch-install-scripts',
			'qemu-user-static',
			'pacman-package-manager',
		]);
	}

	async createRootfs(config: DistroConfig): Promise<void> {
		const sudo = await getSudo();

		// Create rootfs directory first (pacstrap doesn't create it automatically)
		await execWithOutput(sudo || 'mkdir', ['mkdir', '-p', config.rootfs].filter(Boolean));

		// pacstrap needs the arch-keyring to be installed first
		await installPackages(packageManager, ['archlinux-keyring']);

		// Configure pacman mirrorlist - required for pacstrap to work
		// On fresh systems like GitHub Actions, no mirrorlist exists
		const mirrorUrl = 'Server = https://mirrors.kernel.org/archlinux/$repo/os/$arch';
		const mirrorlistPath = '/etc/pacman.d/mirrorlist';

		// Create the directory first - it may not exist on fresh systems
		if (sudo) {
			await execWithOutput('sudo', ['mkdir', '-p', '/etc/pacman.d']);
		} else {
			await execWithOutput('mkdir', ['-p', '/etc/pacman.d']);
		}

		const mirrorCmd = `echo "${mirrorUrl}" | tee ${mirrorlistPath}`;
		if (sudo) {
			await execWithOutput('sudo', ['bash', '-c', mirrorCmd]);
		} else {
			await execWithOutput('bash', ['-c', mirrorCmd]);
		}

		const packages = ['base'];
		if (config.packages.length > 0) {
			packages.push(...config.packages);
		}

		const args = [
			'pacstrap',
			'-c', // Use host cache
			config.rootfs,
			...packages,
		];

		if (sudo) {
			await execWithOutput('sudo', args);
		} else {
			await execWithOutput('pacstrap', ['-c', config.rootfs, ...packages]);
		}
	}
}

// Need to get packageManager from somewhere - will be passed in installTools
let packageManager: PackageManager = 'apt'; // default

export function setPackageManager(pm: PackageManager): void {
	packageManager = pm;
}
