import * as core from '@actions/core';
import { DistroHandler, DistroConfig } from './base';
import { execWithOutput } from '../utils/exec';
import { installPackages, PackageManager, getSudo } from '../utils/system';

export class OpenSUSEHandler implements DistroHandler {
  readonly name = 'openSUSE';

  async validateEnvironment(): Promise<void> {
    core.warning('openSUSE support is experimental and may not work on all hosts');
  }

  async installTools(packageManager: PackageManager): Promise<void> {
    await installPackages(packageManager, ['zypper', 'qemu-user-static']);
  }

  async createRootfs(config: DistroConfig): Promise<void> {
    const sudo = await getSudo();
    
    // Create initial directory structure
    await execWithOutput(sudo || 'mkdir', ['mkdir', '-p', config.rootfs].filter(Boolean));
    
    // Add repository based on version
    let repoUrl: string;
    if (config.version === 'tumbleweed') {
      repoUrl = 'https://download.opensuse.org/tumbleweed/repo/oss/';
    } else if (config.version.startsWith('leap/')) {
      const leapVersion = config.version.replace('leap/', '');
      repoUrl = `https://download.opensuse.org/distribution/leap/${leapVersion}/repo/oss/`;
    } else {
      // Assume it's a leap version number
      repoUrl = `https://download.opensuse.org/distribution/leap/${config.version}/repo/oss/`;
    }

    // Add repo
    const repoArgs = [
      'zypper',
      `--root=${config.rootfs}`,
      'addrepo',
      '-f',
      repoUrl,
      'repo-oss'
    ];

    if (sudo) {
      await execWithOutput('sudo', repoArgs);
    } else {
      await execWithOutput('zypper', repoArgs.slice(1));
    }

    // Install minimal base pattern
    const packages = ['patterns-base-minimal_base'];
    if (config.packages.length > 0) {
      packages.push(...config.packages);
    }

    const installArgs = [
      'zypper',
      `--root=${config.rootfs}`,
      'install',
      '-y',
      '--no-recommends',
      ...packages
    ];

    if (sudo) {
      await execWithOutput('sudo', installArgs);
    } else {
      await execWithOutput('zypper', installArgs.slice(1));
    }
  }
}