import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { DistroHandler, DistroConfig } from './base';
import { execWithOutput } from '../utils/exec';
import { installPackages, PackageManager, getSudo } from '../utils/system';
import * as fs from 'fs';

export class AlpineHandler implements DistroHandler {
  readonly name = 'Alpine Linux';
  private alpineMakeRootfsPath?: string;

  async validateEnvironment(): Promise<void> {
    return;
  }

  async installTools(packageManager: PackageManager): Promise<void> {
    // Install wget to download alpine-make-rootfs
    await installPackages(packageManager, ['wget', 'qemu-user-static']);
    
    // Download alpine-make-rootfs script
    const version = 'v0.8.1';
    const url = `https://raw.githubusercontent.com/alpinelinux/alpine-make-rootfs/${version}/alpine-make-rootfs`;
    
    core.info(`Downloading alpine-make-rootfs ${version}...`);
    const downloadPath = await tc.downloadTool(url);
    
    // Make it executable
    await fs.promises.chmod(downloadPath, 0o755);
    
    this.alpineMakeRootfsPath = downloadPath;
  }

  async createRootfs(config: DistroConfig): Promise<void> {
    if (!this.alpineMakeRootfsPath) {
      throw new Error('alpine-make-rootfs not downloaded');
    }

    const sudo = await getSudo();
    
    const args = [
      this.alpineMakeRootfsPath,
      '--branch', config.version
    ];

    if (config.packages.length > 0) {
      args.push('--packages', config.packages.join(' '));
    }

    args.push(config.rootfs);

    if (sudo) {
      await execWithOutput('sudo', args);
    } else {
      await execWithOutput(this.alpineMakeRootfsPath, [
        '--branch', config.version,
        ...(config.packages.length > 0 ? ['--packages', config.packages.join(' ')] : []),
        config.rootfs
      ]);
    }
  }
}