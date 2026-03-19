import * as fs from 'fs';
import * as path from 'path';
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

		// Configure pacman - required for pacstrap to work
		// On fresh systems like GitHub Actions, no pacman.conf or mirrorlist exists
		const pacmanConfPath = '/etc/pacman.conf';
		const mirrorUrl = 'Server = https://mirrors.kernel.org/archlinux/$repo/os/$arch';
		const mirrorlistPath = '/etc/pacman.d/mirrorlist';

		// Create the directory first - it may not exist on fresh systems
		if (sudo) {
			await execWithOutput('sudo', ['mkdir', '-p', '/etc/pacman.d']);
		} else {
			await execWithOutput('mkdir', ['-p', '/etc/pacman.d']);
		}

		// Create minimal pacman.conf if it doesn't exist
		const pacmanConfContent = `[options]
HoldPkg = pacman glibc
Architecture = auto

[core]
Include = /etc/pacman.d/mirrorlist

[extra]
Include = /etc/pacman.d/mirrorlist
`;
		const tempPacmanConf = path.join('/tmp', 'pacman.conf');
		if (!fs.existsSync(pacmanConfPath)) {
			fs.writeFileSync(tempPacmanConf, pacmanConfContent);
			if (sudo) {
				await execWithOutput('sudo', ['cp', tempPacmanConf, pacmanConfPath]);
			} else {
				fs.copyFileSync(tempPacmanConf, pacmanConfPath);
			}
		}

		// Write mirrorlist directly using Node.js fs, then fix permissions with sudo
		// This avoids all shell quoting/escaping issues
		const tempMirrorlist = path.join('/tmp', 'mirrorlist');
		fs.writeFileSync(tempMirrorlist, mirrorUrl + '\n');
		if (sudo) {
			await execWithOutput('sudo', ['cp', tempMirrorlist, mirrorlistPath]);
		} else {
			fs.copyFileSync(tempMirrorlist, mirrorlistPath);
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
