export interface DistroConfig {
  name: string;
  arch: string;
  version: string;
  packages: string[];
  rootfs: string;
}

export interface DistroHandler {
  readonly name: string;
  validateEnvironment(): Promise<void>;
  installTools(packageManager: string): Promise<void>;
  createRootfs(config: DistroConfig): Promise<void>;
}