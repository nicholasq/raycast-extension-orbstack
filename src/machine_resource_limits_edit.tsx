import { ActionPanel, Action, Form, showToast, Toast } from "@raycast/api";
import { useExec, useForm } from "@raycast/utils";
import { useState } from "react";
import { OrbMachine, ORB_CTL } from "./orbstack";
import { useMachineInfo } from "./hooks";

interface MachineResourceLimitsEditProps {
  machineName: string;
  currentLimits: OrbMachine["config"];
  refresh?: () => void;
}

interface MachineResourceLimitValues {
  cpu?: string;
  memory?: string;
  disk?: string;
}

type ResourceLimitName = "cpu" | "memory" | "disk";

interface ResourceLimitUpdate {
  key: string;
  label: string;
  value: string;
  successMessage: string;
  failureDescription: string;
}

interface ResourceLimitUpdateBatch {
  updates: ResourceLimitUpdate[];
  index: number;
}

// Live-tested on OrbStack 2.2.5: setting a resource key to 0 removes its effective per-machine limit.
function createResetUpdate(machineName: string, resource: ResourceLimitName): ResourceLimitUpdate {
  switch (resource) {
    case "cpu":
      return {
        key: `machine.${machineName}.cpu`,
        label: "CPU limit",
        value: "0",
        successMessage: "CPU now uses OrbStack's global limit.",
        failureDescription: "switch the CPU limit to OrbStack's global limit",
      };
    case "memory":
      return {
        key: `machine.${machineName}.memory_mib`,
        label: "memory limit",
        value: "0",
        successMessage: "Memory now uses OrbStack's global limit.",
        failureDescription: "switch the memory limit to OrbStack's global limit",
      };
    case "disk":
      return {
        key: `machine.${machineName}.disk_bytes`,
        label: "disk limit",
        value: "0",
        successMessage: "Disk limit removed.",
        failureDescription: "remove the disk limit",
      };
  }
}

function validatePositiveInteger(value?: string): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  return /^[1-9]\d*$/.test(trimmedValue) && Number.isSafeInteger(Number(trimmedValue))
    ? undefined
    : "CPU limit must be a positive whole number";
}

function validatePositiveGiB(value: string | undefined, label: string, unitsPerGiB: number): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  const numericValue = Number(trimmedValue);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmedValue) || !Number.isFinite(numericValue) || numericValue <= 0) {
    return `${label} must be a positive number in GiB`;
  }

  const convertedValue = Math.round(numericValue * unitsPerGiB);
  return Number.isSafeInteger(convertedValue) && convertedValue > 0
    ? undefined
    : `${label} is outside the supported range`;
}

function validateDiskLimit(value: string | undefined, currentUsageBytes: number | undefined): string | undefined {
  const baseError = validatePositiveGiB(value, "Disk limit", 1024 ** 3);
  if (baseError || !value?.trim()) return baseError;

  if (currentUsageBytes == null || !Number.isFinite(currentUsageBytes) || currentUsageBytes < 0) {
    return "Unable to verify current disk usage. Refresh machine details and try again.";
  }

  const limitBytes = Math.round(Number(value.trim()) * 1024 ** 3);
  if (limitBytes <= currentUsageBytes) {
    const currentUsageGiB = Number((currentUsageBytes / 1024 ** 3).toFixed(2));
    return `Disk limit must be greater than current usage (${currentUsageGiB} GiB).`;
  }

  return undefined;
}

function hasResourceLimit(limit: number | null | undefined): boolean {
  return limit != null && limit > 0;
}

function formatCpuLimit(limit: number | null | undefined): string {
  if (limit == null || limit <= 0) return "Uses global limit";
  return `${limit} ${limit === 1 ? "core" : "cores"}`;
}

function formatGiBLimit(limit: number | null | undefined, unitsPerGiB: number, unsetLabel: string): string {
  if (limit == null || limit <= 0) return unsetLabel;
  return `${Number((limit / unitsPerGiB).toFixed(2))} GiB`;
}

export default function MachineResourceLimitsEdit({
  machineName,
  currentLimits: initialCurrentLimits,
  refresh,
}: MachineResourceLimitsEditProps) {
  const { machineInfo, isLoadingMachineInfo, revalidateMachineInfo } = useMachineInfo(machineName);
  const currentMachineInfo = machineInfo?.record.name === machineName ? machineInfo : null;
  const currentLimits = currentMachineInfo?.record.config ?? initialCurrentLimits;
  const currentDiskUsageBytes = currentMachineInfo?.disk_size;
  const [useGlobalCpuLimit, setUseGlobalCpuLimit] = useState(() => !hasResourceLimit(currentLimits.cpu_limit));
  const [useGlobalMemoryLimit, setUseGlobalMemoryLimit] = useState(
    () => !hasResourceLimit(currentLimits.memory_limit_mib),
  );
  const [noPerMachineDiskLimit, setNoPerMachineDiskLimit] = useState(
    () => !hasResourceLimit(currentLimits.disk_limit_bytes),
  );
  const [updateBatch, setUpdateBatch] = useState<ResourceLimitUpdateBatch | null>(null);
  const activeUpdate = updateBatch?.updates[updateBatch.index];

  const startUpdateBatch = (updates: ResourceLimitUpdate[]) => {
    setUpdateBatch({ updates, index: 0 });
    showToast({
      title: "Applying Resource Limit Changes",
      message: `Applying changes to ${updates.map((update) => update.label).join(", ")} for ${machineName}.`,
      style: Toast.Style.Animated,
    });
  };

  const { isLoading } = useExec(ORB_CTL, activeUpdate ? ["config", "set", activeUpdate.key, activeUpdate.value] : [], {
    execute: activeUpdate !== undefined,
    onData: () => {
      if (!updateBatch || !activeUpdate) return;

      const nextIndex = updateBatch.index + 1;
      if (nextIndex < updateBatch.updates.length) {
        setUpdateBatch({ ...updateBatch, index: nextIndex });
        return;
      }

      setUpdateBatch(null);
      revalidateMachineInfo();
      refresh?.();
      showToast({
        title: "Resource Limits Updated",
        message: updateBatch.updates.map((update) => update.successMessage).join(" "),
        style: Toast.Style.Success,
      });
    },
    onError: (error) => {
      if (!updateBatch || !activeUpdate) return;

      const completedUpdates = updateBatch.updates.slice(0, updateBatch.index);
      const completedMessage = completedUpdates.length
        ? `${completedUpdates.map((update) => update.successMessage).join(" ")} `
        : "No resource limits were changed. ";
      setUpdateBatch(null);
      revalidateMachineInfo();
      refresh?.();
      showToast({
        title: completedUpdates.length ? "Some Changes Applied" : "Resource Update Failed",
        message: `${completedMessage}Failed to ${activeUpdate.failureDescription}; later changes were not attempted. ${error.message}`,
        style: Toast.Style.Failure,
      });
    },
  });

  const handleUpdate = (values: MachineResourceLimitValues) => {
    const updates: ResourceLimitUpdate[] = [];
    const cpu = values.cpu?.trim();
    const memory = values.memory?.trim();
    const disk = values.disk?.trim();

    if (useGlobalCpuLimit && hasResourceLimit(currentLimits.cpu_limit)) {
      updates.push(createResetUpdate(machineName, "cpu"));
    } else if (!useGlobalCpuLimit && cpu) {
      updates.push({
        key: `machine.${machineName}.cpu`,
        label: "CPU limit",
        value: cpu,
        successMessage: "CPU limit updated.",
        failureDescription: "update the CPU limit",
      });
    } else if (!cpu) {
      setUseGlobalCpuLimit(!hasResourceLimit(currentLimits.cpu_limit));
    }

    if (useGlobalMemoryLimit && hasResourceLimit(currentLimits.memory_limit_mib)) {
      updates.push(createResetUpdate(machineName, "memory"));
    } else if (!useGlobalMemoryLimit && memory) {
      updates.push({
        key: `machine.${machineName}.memory_mib`,
        label: "memory limit",
        value: String(Math.round(Number(memory) * 1024)),
        successMessage: "Memory limit updated.",
        failureDescription: "update the memory limit",
      });
    } else if (!memory) {
      setUseGlobalMemoryLimit(!hasResourceLimit(currentLimits.memory_limit_mib));
    }

    if (noPerMachineDiskLimit && hasResourceLimit(currentLimits.disk_limit_bytes)) {
      updates.push(createResetUpdate(machineName, "disk"));
    } else if (!noPerMachineDiskLimit && disk) {
      const diskError = validateDiskLimit(disk, currentDiskUsageBytes);
      if (diskError) {
        showToast({
          title: "Invalid Disk Limit",
          message: diskError,
          style: Toast.Style.Failure,
        });
        return;
      }

      updates.push({
        key: `machine.${machineName}.disk_bytes`,
        label: "disk limit",
        value: String(Math.round(Number(disk) * 1024 ** 3)),
        successMessage: "Disk limit updated.",
        failureDescription: "update the disk limit",
      });
    } else if (!disk) {
      setNoPerMachineDiskLimit(!hasResourceLimit(currentLimits.disk_limit_bytes));
    }

    if (updates.length === 0) {
      showToast({
        title: "No Changes",
        message: "The selected settings are already in effect, or fields were left unchanged.",
        style: Toast.Style.Success,
      });
      return;
    }

    startUpdateBatch(updates);
  };

  const { handleSubmit, itemProps, setValue } = useForm<MachineResourceLimitValues>({
    onSubmit: handleUpdate,
    validation: {
      cpu: validatePositiveInteger,
      memory: (value) => validatePositiveGiB(value, "Memory limit", 1024),
      disk: (value) => validateDiskLimit(value, currentDiskUsageBytes),
    },
  });

  return (
    <Form
      navigationTitle={`Edit Resource Limits: ${machineName}`}
      isLoading={isLoading || isLoadingMachineInfo}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Update Limits" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="How Editing Works"
        text="Check CPU or Memory to use OrbStack's global limit. Check Disk for no disk limit. Uncheck an option to enter a custom value. Blank fields keep the current setting; checking an option clears any unsaved value for that resource."
      />
      <Form.Description title="Current CPU Limit" text={formatCpuLimit(currentLimits.cpu_limit)} />
      <Form.Checkbox
        id="useGlobalCpuLimit"
        title="CPU"
        label="Use OrbStack's global CPU limit"
        value={useGlobalCpuLimit}
        onChange={(checked) => {
          setUseGlobalCpuLimit(checked);
          if (checked) setValue("cpu", "");
        }}
      />
      {useGlobalCpuLimit ? (
        <Form.Description title="CPU Limit (Cores)" text="Using OrbStack's global CPU limit." />
      ) : (
        <Form.TextField title="CPU Limit (Cores)" placeholder="Leave blank to keep current value" {...itemProps.cpu} />
      )}
      <Form.Description
        title="Current Memory Limit"
        text={formatGiBLimit(currentLimits.memory_limit_mib, 1024, "Uses global limit")}
      />
      <Form.Checkbox
        id="useGlobalMemoryLimit"
        title="Memory"
        label="Use OrbStack's global memory limit"
        value={useGlobalMemoryLimit}
        onChange={(checked) => {
          setUseGlobalMemoryLimit(checked);
          if (checked) setValue("memory", "");
        }}
      />
      {useGlobalMemoryLimit ? (
        <Form.Description title="Memory Limit (GiB)" text="Using OrbStack's global memory limit." />
      ) : (
        <Form.TextField
          title="Memory Limit (GiB)"
          placeholder="Leave blank to keep current value"
          {...itemProps.memory}
        />
      )}
      <Form.Description
        title="Current Disk Limit"
        text={formatGiBLimit(currentLimits.disk_limit_bytes, 1024 ** 3, "No disk limit")}
      />
      <Form.Checkbox
        id="noPerMachineDiskLimit"
        title="Disk"
        label="No disk limit"
        value={noPerMachineDiskLimit}
        onChange={(checked) => {
          setNoPerMachineDiskLimit(checked);
          if (checked) setValue("disk", "");
        }}
      />
      <Form.Description
        title="Current Disk Usage"
        text={
          currentDiskUsageBytes == null
            ? "Unavailable; refresh before setting a disk limit."
            : `${(currentDiskUsageBytes / 1024 ** 3).toFixed(2)} GiB in use`
        }
      />
      {!noPerMachineDiskLimit && (
        <Form.TextField
          title="Disk Limit (Maximum GiB)"
          placeholder="Leave blank to keep current value"
          {...itemProps.disk}
        />
      )}
    </Form>
  );
}
