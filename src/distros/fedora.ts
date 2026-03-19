import * as core from '@actions/core';
import { execWithOutput } from '../utils/exec';
import { getSudo, installPackages, type PackageManager } from '../utils/system';
import type { DistroConfig, DistroHandler } from './base';

export class FedoraHandler implements DistroHandler {
	readonly name = 'Fedora';

	async validateEnvironment(): Promise<void> {
		core.warning('Fedora support is experimental and may not work on all hosts');
	}

	async installTools(packageManager: PackageManager): Promise<void> {
		// dnf is typically available on Fedora hosts
		// For Debian/Ubuntu hosts, we'd need to set up dnf
		if (packageManager === 'apt') {
			// On Debian-based systems, we might need to use a different approach
			core.warning('Installing Fedora rootfs on Debian-based host requires dnf');
		}

		await installPackages(packageManager, ['dnf', 'qemu-user-static']);
	}

	async createRootfs(config: DistroConfig): Promise<void> {
		const sudo = await getSudo();

		// Create initial directory structure
		await execWithOutput(sudo || 'mkdir', ['mkdir', '-p', config.rootfs].filter(Boolean));

		// Use dnf to install minimal system
		// This requires dnf to be configured with Fedora repos
		const basePackages = ['systemd', 'dnf'];
		if (config.packages.length > 0) {
			basePackages.push(...config.packages);
		}

		const args = [
			'dnf',
			`--installroot=${config.rootfs}`,
			`--releasever=${config.version}`,
			'--repo=fedora',
			'--repo=updates',
			'--setopt=install_weak_deps=False',
			'install',
			'-y',
			...basePackages,
		];

		if (sudo) {
			await execWithOutput('sudo', args);
		} else {
			await execWithOutput('dnf', args.slice(1));
		}

		// Clean up
		const cleanArgs = ['dnf', `--installroot=${config.rootfs}`, 'clean', 'all'];

		if (sudo) {
			await execWithOutput('sudo', cleanArgs);
		} else {
			await execWithOutput('dnf', cleanArgs.slice(1));
		}
	}
}
