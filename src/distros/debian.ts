import * as core from '@actions/core';
import { execWithOutput } from '../utils/exec';
import { getSudo, installPackages, type PackageManager } from '../utils/system';
import type { DistroConfig, DistroHandler } from './base';

export class DebianHandler implements DistroHandler {
	readonly name = 'Debian/Ubuntu';

	async validateEnvironment(): Promise<void> {
		// Debian can run on any Linux with proper tools
		return;
	}

	async installTools(packageManager: PackageManager): Promise<void> {
		const packages = ['debootstrap'];

		// Check if we need qemu for cross-architecture
		// Note: actual cross-arch detection would need more work
		packages.push('qemu-user-static');

		await installPackages(packageManager, packages);
	}

	async createRootfs(config: DistroConfig): Promise<void> {
		const sudo = await getSudo();
		const args = [
			'debootstrap',
			'--variant=minbase',
			'--arch',
			config.arch,
			config.version,
			config.rootfs,
		];

		if (sudo) {
			await execWithOutput('sudo', args);
		} else {
			await execWithOutput('debootstrap', [
				'--variant=minbase',
				'--arch',
				config.arch,
				config.version,
				config.rootfs,
			]);
		}

		// Install additional packages if specified
		if (config.packages.length > 0) {
			core.info(`Installing additional packages: ${config.packages.join(' ')}`);
			const chrootArgs = ['chroot', config.rootfs, 'apt-get', 'update'];
			const installArgs = [
				'chroot',
				config.rootfs,
				'apt-get',
				'install',
				'-y',
				'--no-install-recommends',
				...config.packages,
			];

			if (sudo) {
				await execWithOutput('sudo', chrootArgs);
				await execWithOutput('sudo', installArgs);
			} else {
				await execWithOutput('chroot', chrootArgs.slice(1));
				await execWithOutput('chroot', installArgs.slice(1));
			}
		}
	}
}
