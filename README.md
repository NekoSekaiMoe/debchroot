# debchroot

A GitHub Action for creating cross-distribution rootfs and executing commands in a chroot environment.

## Features

- **Multiple Distributions**: Support for Debian, Ubuntu, Arch Linux, Alpine Linux, Fedora, and openSUSE
- **Cross-Architecture**: Build rootfs for different architectures using qemu-user-static
- **Universal Host Support**: Works on Debian, Ubuntu, Fedora, openSUSE, and Arch Linux runners
- **TypeScript Implementation**: Modern, type-safe codebase

## Usage

### Basic Example

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'debian'
    version: 'bookworm'
    arch: 'arm64'

- run: debsh uname -a
```

### Distribution Examples

#### Debian/Ubuntu

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'debian'
    version: 'bookworm'  # or 'bullseye', 'trixie'
    arch: 'arm64'
    packages: 'curl git'
```

#### Arch Linux

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'arch'
    arch: 'arm64'
    packages: 'base-devel git'
```

#### Alpine Linux

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'alpine'
    version: 'v3.19'  # or 'edge'
    arch: 'arm64'
    packages: 'curl git'
```

#### Fedora (Experimental)

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'fedora'
    version: '40'
    arch: 'arm64'
```

#### openSUSE (Experimental)

```yaml
- uses: NekoSekaiMoe/debchroot@main
  with:
    distro: 'opensuse'
    version: 'tumbleweed'  # or 'leap/15.5'
    arch: 'arm64'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `distro` | Target distribution (debian, ubuntu, arch, alpine, fedora, opensuse) | No | `debian` |
| `arch` | Target architecture (amd64, arm64, armhf, i386) | No | `arm64` |
| `version` | Distribution version | No | `bookworm` |
| `packages` | Additional packages (space-separated) | No | `""` |

### Version Guidelines

- **Debian/Ubuntu**: Use release codenames (`bookworm`, `bullseye`, `jammy`, `noble`)
- **Arch**: Version is ignored (`base`)
- **Alpine**: Use `v3.19`, `v3.20`, `edge`
- **Fedora**: Use version numbers (`39`, `40`, `rawhide`)
- **openSUSE**: Use `tumbleweed` or `leap/15.5` format

## Outputs

| Output | Description |
|--------|-------------|
| `rootfs` | Path to the created rootfs (typically `~/rootfs`) |

## Using debsh

After the action runs, you can use the `debsh` command to execute commands in the chroot:

```yaml
- run: debsh uname -a
- run: debsh cat /etc/os-release
- run: debsh apt-get update && debsh apt-get install -y vim
```

## Requirements

- Linux-based GitHub Actions runner
- Root or sudo access
- Supported package manager: apt, dnf, zypper, or pacman

## Supported Host Systems

This action can run on various Linux distributions:

- Debian/Ubuntu (primary)
- Fedora
- openSUSE
- Arch Linux

## How It Works

1. Detects the host's package manager
2. Installs necessary tools (debootstrap, pacstrap, alpine-make-rootfs, dnf, zypper, qemu-user-static)
3. Creates the rootfs using distribution-specific methods
4. Installs additional packages if specified
5. Creates the `debsh` script for chroot access
6. Tests the chroot environment

## Development

### Building

```bash
npm install
npm run build
```

### Testing Locally

```bash
npm run dev
```

## License

Apache-2.0