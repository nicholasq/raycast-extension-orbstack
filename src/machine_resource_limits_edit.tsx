import { ActionPanel, Action, Form, showToast, Toast } from "@raycast/api";
import { useExec, useForm } from "@raycast/utils";
import { useState } from "react";
import { OrbMachine, ORB_CTL } from "./orbstack";

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

interface ResourceLimitUpdate {
  key: string;
  label: string;
  value: string;
}

interface ResourceLimitUpdateBatch {
  updates: ResourceLimitUpdate[];
  index: number;
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

function formatCpuLimit(limit: number | null | undefined): string {
  if (limit == null) return "Uses global limit";
  return `${limit} ${limit === 1 ? "core" : "cores"}`;
}

function formatGiBLimit(limit: number | null | undefined, unitsPerGiB: number, unsetLabel: string): string {
  if (limit == null) return unsetLabel;
  return `${Number((limit / unitsPerGiB).toFixed(2))} GiB`;
}

export default function MachineResourceLimitsEdit({
  machineName,
  currentLimits,
  refresh,
}: MachineResourceLimitsEditProps) {
  const [updateBatch, setUpdateBatch] = useState<ResourceLimitUpdateBatch | null>(null);
  const activeUpdate = updateBatch?.updates[updateBatch.index];

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
      refresh?.();
      showToast({
        title: "Resource Limits Updated",
        message: `Updated ${updateBatch.updates.map((update) => update.label).join(", ")}.`,
        style: Toast.Style.Success,
      });
    },
    onError: (error) => {
      if (!updateBatch || !activeUpdate) return;

      const completedUpdates = updateBatch.updates.slice(0, updateBatch.index);
      const completedMessage = completedUpdates.length
        ? `Updated ${completedUpdates.map((update) => update.label).join(", ")}. `
        : "No limits were updated. ";

      setUpdateBatch(null);
      refresh?.();
      showToast({
        title: completedUpdates.length ? "Some Limits Updated" : "Limit Update Failed",
        message: `${completedMessage}Failed to update ${activeUpdate.label}; later updates were not attempted. ${error.message}`,
        style: Toast.Style.Failure,
      });
    },
  });

  const handleUpdate = (values: MachineResourceLimitValues) => {
    const updates: ResourceLimitUpdate[] = [];
    const cpu = values.cpu?.trim();
    const memory = values.memory?.trim();
    const disk = values.disk?.trim();

    if (cpu) {
      updates.push({
        key: `machine.${machineName}.cpu`,
        label: "CPU limit",
        value: cpu,
      });
    }
    if (memory) {
      updates.push({
        key: `machine.${machineName}.memory_mib`,
        label: "memory limit",
        value: String(Math.round(Number(memory) * 1024)),
      });
    }
    if (disk) {
      updates.push({
        key: `machine.${machineName}.disk_bytes`,
        label: "disk maximum",
        value: String(Math.round(Number(disk) * 1024 ** 3)),
      });
    }

    if (updates.length === 0) {
      showToast({
        title: "No Limits Updated",
        message: "Enter at least one value. Blank fields are left unchanged.",
        style: Toast.Style.Failure,
      });
      return;
    }

    setUpdateBatch({ updates, index: 0 });
    showToast({
      title: "Updating Resource Limits",
      message: `Updating ${updates.map((update) => update.label).join(", ")} for ${machineName}.`,
      style: Toast.Style.Animated,
    });
  };

  const { handleSubmit, itemProps } = useForm<MachineResourceLimitValues>({
    onSubmit: handleUpdate,
    validation: {
      cpu: validatePositiveInteger,
      memory: (value) => validatePositiveGiB(value, "Memory limit", 1024),
      disk: (value) => validatePositiveGiB(value, "Disk limit", 1024 ** 3),
    },
  });

  return (
    <Form
      navigationTitle={`Edit Resource Limits: ${machineName}`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Update Limits" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Current Limits"
        text={`CPU: ${formatCpuLimit(currentLimits.cpu_limit)}; memory: ${formatGiBLimit(currentLimits.memory_limit_mib, 1024, "Uses global limit")}; disk maximum: ${formatGiBLimit(currentLimits.disk_limit_bytes, 1024 ** 3, "No per-machine limit")}.`}
      />
      <Form.Description
        title="How Editing Works"
        text="Enter only the limits to change. Leave any field blank to keep its current value. Restoring OrbStack's global default is not available in this UI."
      />
      <Form.TextField title="CPU Limit (Cores)" placeholder="Leave blank to keep current value" {...itemProps.cpu} />
      <Form.TextField
        title="Memory Limit (GiB)"
        placeholder="Leave blank to keep current value"
        {...itemProps.memory}
      />
      <Form.TextField
        title="Disk Limit (Maximum GiB)"
        placeholder="Leave blank to keep current value"
        {...itemProps.disk}
      />
    </Form>
  );
}
