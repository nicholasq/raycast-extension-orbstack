# OrbStack

Manage OrbStack machines and containers directly from Raycast

## Features

- **Quick Machine Management** - Start, stop, and monitor OrbStack Linux machines instantly
- **Easy Machine Creation** - Create new Linux machines with supported distributions
- **Architecture Support** - Choose between arm64 and amd64 architectures
- **Real-time Status** - Visual indicators for machine states (running, stopped, paused)

## Prerequisites

Before using this extension, you must have:

1. **OrbStack installed** on your macOS device
   - [Download from orbstack.dev](https://docs.orbstack.dev/install)
   - Or install via Homebrew: `brew install orbstack`
2. **OrbStack CLI tools** (`orbctl`) automatically installed with OrbStack

## Installation

1. Open Raycast
2. Run Store command
3. Search for "OrbStack"
4. Install the extension

## Usage

### Managing Machines

Use the **"Manage Machines"** command to:

- View all your OrbStack Linux machines
- See machine details (distribution, version, architecture, status)
- Start stopped machines with one click
- Stop running machines instantly
- Refresh the machine list with `⌘+R`

Each machine displays:

- **Name** - Custom machine name
- **Distribution Info** - OS version and architecture
- **Status** - Current state with color-coded icons

### Creating New Machines

Use the **"Create Machine"** command to:

1. Enter a machine name
2. Choose Linux distribution
3. Select architecture (arm64 or amd64)
4. Create with one click

Supported distributions include:

- Ubuntu, Debian, Fedora, CentOS
- Arch Linux, Alpine Linux, openSUSE
- Kali Linux, NixOS, Gentoo
- And many more...

## Commands

### `Manage Machines`

Lists all OrbStack machines with their current status and provides quick actions:

- **Start Machine** - Launch a stopped machine
- **Stop Machine** - Shutdown a running machine
- **Refresh** - Update the machine list

### `Create Machine`

Create a new Linux virtual machine:

- **Machine Name** - Custom identifier for your machine
- **Distribution** - Choose from supported Linux distributions
- **Architecture** - arm64 (Apple Silicon) or amd64 (Intel)

## Troubleshooting

### "orbctl command not found"

Ensure OrbStack is properly installed and the CLI tools are available:

```bash
orbctl --version
```

### Machines not appearing

1. Check OrbStack is running
2. Verify machines exist: `orbctl list`
3. Restart OrbStack if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
