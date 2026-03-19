import { DistroHandler } from './base';
import { DebianHandler } from './debian';
import { ArchHandler } from './arch';
import { AlpineHandler } from './alpine';
import { FedoraHandler } from './fedora';
import { OpenSUSEHandler } from './opensuse';

export * from './base';
export { DebianHandler } from './debian';
export { ArchHandler } from './arch';
export { AlpineHandler } from './alpine';
export { FedoraHandler } from './fedora';
export { OpenSUSEHandler } from './opensuse';

export function getDistroHandler(distro: string): DistroHandler {
  const normalizedDistro = distro.toLowerCase();
  
  switch (normalizedDistro) {
    case 'debian':
    case 'ubuntu':
      return new DebianHandler();
    case 'arch':
    case 'archlinux':
      return new ArchHandler();
    case 'alpine':
    case 'alpinelinux':
      return new AlpineHandler();
    case 'fedora':
      return new FedoraHandler();
    case 'opensuse':
    case 'suse':
      return new OpenSUSEHandler();
    default:
      throw new Error(`Unsupported distribution: ${distro}. Supported: debian, ubuntu, arch, alpine, fedora, opensuse`);
  }
}