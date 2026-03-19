import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { getDistroHandler } from './distros';
import { detectPackageManager } from './utils/system';
import { createDebsh } from './utils/debsh';

export async function run(): Promise<void> {
  try {
    // Get inputs
    const distro = core.getInput('distro') || 'debian';
    const arch = core.getInput('arch') || 'arm64';
    const version = core.getInput('version') || 'bookworm';
    const packagesInput = core.getInput('packages') || '';
    const packages = packagesInput.split(/\s+/).filter(p => p.length > 0);

    core.info(`Creating ${distro} rootfs...`);
    core.info(`  Architecture: ${arch}`);
    core.info(`  Version: ${version}`);
    if (packages.length > 0) {
      core.info(`  Additional packages: ${packages.join(' ')}`);
    }

    // Detect package manager
    const pm = await detectPackageManager();
    if (pm === 'unknown') {
      throw new Error('Unsupported package manager. Requires: apt, dnf, zypper, or pacman');
    }
    core.info(`Detected package manager: ${pm}`);

    // Get handler for the distribution
    const handler = getDistroHandler(distro);
    core.info(`Using ${handler.name} handler`);

    // Validate environment
    core.startGroup('Validating environment');
    await handler.validateEnvironment();
    core.endGroup();

    // Install required tools
    core.startGroup('Installing tools');
    await handler.installTools(pm);
    core.endGroup();

    // Create rootfs
    const rootfs = `${process.env.HOME}/rootfs`;
    core.startGroup('Creating rootfs');
    await handler.createRootfs({
      name: distro,
      arch,
      version,
      packages,
      rootfs
    });
    core.endGroup();

    // Create debsh script
    core.startGroup('Creating debsh');
    await createDebsh(rootfs);
    core.endGroup();

    // Test the chroot
    core.startGroup('Testing chroot');
    await exec.exec('debsh', ['uname', '-a']);
    core.endGroup();

    // Set outputs
    core.setOutput('rootfs', rootfs);
    core.info(`✅ Successfully created ${distro} rootfs at ${rootfs}`);

  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();