import { Tool } from "@raycast/api";
import { ORB_CTL, ISOLATED_MACHINES_VERSION, MACHINE_RESOURCE_LIMITS_VERSION, parseOrbctlVersion } from "../orbstack";
import { execAsync, isVersionAtLeast } from "../utils";
import { CreateArgs, validateCreateArgs } from "./types";

async function getOrbctlVersion(): Promise<string> {
  const { stdout } = await execAsync(`${ORB_CTL} version`, { timeout: 1000 * 10 }); // Let's wait at most 10 seconds to get the version.
  const version = parseOrbctlVersion(stdout);

  if (!version) {
    throw new Error(`Failed to get orbctl version. Please ensure OrbStack is installed and running.`);
  }

  return version;
}

function assertOrbctlVersion(version: string, minimumVersion: string, feature: string): void {
  if (!isVersionAtLeast(version, minimumVersion)) {
    throw new Error(
      `${feature} require orbctl ${minimumVersion} or later. Current version: ${version}. Please upgrade OrbStack.`,
    );
  }
}

function hasMachineResourceLimits(args: CreateArgs): boolean {
  return args.cpus !== undefined || args.memory_gib !== undefined || args.disk_gib !== undefined;
}

function createMachineCommand(args: CreateArgs): string {
  const arch = ` -a ${args.architecture}`;
  const user_name = args.user_name ? ` -u ${args.user_name}` : "";
  const isolated = args.isolated ? " --isolated" : "";
  const cpus = args.cpus !== undefined ? ` --cpus ${args.cpus}` : "";
  const memory = args.memory_gib !== undefined ? ` --memory ${args.memory_gib}G` : "";
  const disk = args.disk_gib !== undefined ? ` --disk ${args.disk_gib}G` : "";
  const distro = args.version ? ` ${args.distro}:${args.version}` : ` ${args.distro}`;
  return `${ORB_CTL} create${arch}${user_name}${isolated}${cpus}${memory}${disk}${distro} ${args.machine_name}`;
}

export const confirmation: Tool.Confirmation<CreateArgs> = async (args) => {
  if (args.architecture === undefined) {
    args.architecture = "arm64";
  }

  return {
    message: `Run command "${createMachineCommand(args)}"? This can take a few minutes to complete.`,
  };
};

/**
 * This tool runs `orbctl create [-a <arch>] [-u <user_name>] [--isolated] [--cpus <cores>] [--memory <GiB>G] [--disk <GiB>G] <distro>[:<version>] <machine_name>` in a shell and returns the output.
 * If the user did NOT specify a distro or machine name, you NEED TO ASK them for both. These values are required.
 * The --isolated flag creates an isolated machine and requires orbctl 2.1.0+.
 * Resource limits require orbctl 2.2.0+ and must be supplied as positive numbers; memory and disk values are in GiB.
 *
 * @param args machine to create
 * @returns output of shell command
 */
export default async function tool(args: CreateArgs): Promise<string> {
  // We have to set architecture again even though we set it in `confirmation` above.
  // It appears confirmation and tool get call with their own copies of the original data.
  if (args.architecture === undefined) {
    args.architecture = "arm64";
  }

  validateCreateArgs(args);

  if (args.isolated || hasMachineResourceLimits(args)) {
    const version = await getOrbctlVersion();

    if (args.isolated) {
      assertOrbctlVersion(version, ISOLATED_MACHINES_VERSION, "Isolated machines");
    }

    if (hasMachineResourceLimits(args)) {
      assertOrbctlVersion(version, MACHINE_RESOURCE_LIMITS_VERSION, "Machine resource limits");
    }
  }

  const command = createMachineCommand(args);

  const { stdout, stderr } = await execAsync(command, { timeout: 1000 * 120 }); // Let's wait 2 minutes at most.
  if (stderr) {
    throw new Error(stderr);
  }
  return stdout;
}
