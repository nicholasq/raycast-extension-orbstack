import { ActionPanel, Action, Form, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useForm, FormValidation, useExec } from "@raycast/utils";
import { useMemo, useState } from "react";
import { ORB_CTL, DISTROS, ARCHITECTURES } from "./orbstack";
import { supportsIsolatedMachines, supportsMachineResourceLimits } from "./utils";

interface Machine {
  distro: string;
  name: string;
  arch: string;
  user?: string;
  version?: string;
  isolated?: boolean;
  cpus?: string;
  memory?: string;
  disk?: string;
}

function validatePositiveInteger(value?: string): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  return /^[1-9]\d*$/.test(trimmedValue) ? undefined : "CPU limit must be a positive whole number";
}

function validatePositiveGiB(value: string | undefined, label: string): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  const numericValue = Number(trimmedValue);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmedValue) || !Number.isFinite(numericValue) || numericValue <= 0) {
    return `${label} must be a positive number in GiB`;
  }

  return undefined;
}

interface MachineCreateProps {
  refresh?: () => void;
}

export default function MachineCreate(props: MachineCreateProps) {
  const [machine, setMachine] = useState<Machine | null>(null);
  const preferences = getPreferenceValues<Preferences.MachineCreate>();

  const { data: versionOutput } = useExec(ORB_CTL, ["version"]);

  const canCreateIsolatedMachine = useMemo(() => {
    if (!versionOutput) return false;
    return supportsIsolatedMachines(versionOutput);
  }, [versionOutput]);

  const canCreateMachineWithResourceLimits = useMemo(() => {
    if (!versionOutput) return false;
    return supportsMachineResourceLimits(versionOutput);
  }, [versionOutput]);

  const createMachineCommand = (machine: Machine) => {
    const command = ["create"];

    if (machine.user && machine.user.trim() !== "") {
      command.push("-u", machine.user);
    }

    if (machine.isolated) {
      command.push("--isolated");
    }

    if (canCreateMachineWithResourceLimits) {
      if (machine.cpus && machine.cpus.trim() !== "") {
        command.push("--cpus", machine.cpus.trim());
      }

      if (machine.memory && machine.memory.trim() !== "") {
        command.push("--memory", `${machine.memory.trim()}G`);
      }

      if (machine.disk && machine.disk.trim() !== "") {
        command.push("--disk", `${machine.disk.trim()}G`);
      }
    }

    const distroWithVersion =
      machine.version && machine.version.trim() !== "" ? `${machine.distro}:${machine.version}` : machine.distro;

    command.push("-a", machine.arch, distroWithVersion, machine.name);
    return command;
  };

  const { isLoading } = useExec(ORB_CTL, machine ? createMachineCommand(machine) : [], {
    execute: machine !== null,
    timeout: 1000 * 120, // machine creation can take a bit so let's wait at least 2 minutes.
    onData: () => {
      showToast({
        title: "Machine Created",
        message: "Machine has been successfully created.",
        style: Toast.Style.Success,
      });
      setMachine(null);
      if (props.refresh) {
        props.refresh();
      }
    },
    onError: (e) => {
      showToast({
        title: "Machine Creation Failed",
        message: e.message,
        style: Toast.Style.Failure,
      });
      setMachine(null);
    },
  });

  const handleCreate = (values: Machine) => {
    setMachine(values);
    showToast({
      title: "Creating Machine",
      message: "Please wait.",
      style: Toast.Style.Animated,
    });
  };

  const { handleSubmit, itemProps } = useForm<Machine>({
    onSubmit: handleCreate,
    initialValues: {
      cpus: preferences.defaultCpuLimit,
      memory: preferences.defaultMemoryLimit,
      disk: preferences.defaultDiskLimit,
    },
    validation: {
      name: FormValidation.Required,
      distro: FormValidation.Required,
      arch: FormValidation.Required,
      cpus: (value) => (canCreateMachineWithResourceLimits ? validatePositiveInteger(value) : undefined),
      memory: (value) => (canCreateMachineWithResourceLimits ? validatePositiveGiB(value, "Memory limit") : undefined),
      disk: (value) => (canCreateMachineWithResourceLimits ? validatePositiveGiB(value, "Disk limit") : undefined),
    },
  });

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Machine" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Machine Name" placeholder="Enter a name for your Machine" {...itemProps.name} />
      <Form.Dropdown title="Distribution" {...itemProps.distro}>
        {DISTROS.map((distro) => (
          <Form.Dropdown.Item key={distro.value} value={distro.value} title={distro.title} />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Version" placeholder="Leave blank for default distro version" {...itemProps.version} />
      <Form.Dropdown title="Arch" {...itemProps.arch}>
        {ARCHITECTURES.map((arch) => (
          <Form.Dropdown.Item key={arch.value} value={arch.value} title={arch.title} />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Username" placeholder="Leave blank for default username" {...itemProps.user} />
      {canCreateMachineWithResourceLimits && (
        <>
          <Form.TextField
            title="CPU Limit (Cores)"
            placeholder="Leave blank to use the global limit"
            {...itemProps.cpus}
          />
          <Form.TextField
            title="Memory Limit (GiB)"
            placeholder="Leave blank to use the global limit"
            {...itemProps.memory}
          />
          <Form.TextField
            title="Disk Limit (GiB)"
            placeholder="Maximum capacity; leave blank to omit a per-machine disk limit"
            {...itemProps.disk}
          />
        </>
      )}
      {canCreateIsolatedMachine && (
        <Form.Checkbox title="Isolated" label="Create as isolated machine" {...itemProps.isolated} />
      )}
    </Form>
  );
}
