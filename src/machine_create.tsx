import { ActionPanel, Action, Form, showToast, Toast } from "@raycast/api";
import { useForm, FormValidation, useExec } from "@raycast/utils";
import { useState } from "react";
import { Architecture, Distro } from "./orbstack";

export const DISTROS: { value: Distro; title: string }[] = [
  { value: "alma", title: "AlmaLinux" },
  { value: "alpine", title: "Alpine Linux" },
  { value: "arch", title: "Arch Linux" },
  { value: "centos", title: "CentOS" },
  { value: "debian", title: "Debian" },
  { value: "devuan", title: "Devuan" },
  { value: "fedora", title: "Fedora" },
  { value: "gentoo", title: "Gentoo" },
  { value: "kali", title: "Kali Linux" },
  { value: "nixos", title: "NixOS" },
  { value: "openeuler", title: "openEuler" },
  { value: "opensuse", title: "openSUSE" },
  { value: "oracle", title: "Oracle Linux" },
  { value: "rocky", title: "Rocky Linux" },
  { value: "ubuntu", title: "Ubuntu" },
  { value: "void", title: "Void Linux" },
];

export const ARCHITECTURES: { value: Architecture; title: string }[] = [
  { value: "arm64", title: "arm64" },
  { value: "amd64", title: "x86_64" },
];

interface CreateMachineFormValues {
  name: string;
  distro: string;
  arch: string;
}

export default function Command() {
  const [machine, setMachine] = useState<{ distro: string; name: string; arch: string } | null>(null);
  const { isLoading } = useExec(
    "orbctl",
    ["create", "-a", machine?.arch ?? "", machine?.distro ?? "", machine?.name ?? ""],
    {
      execute: machine !== null,
      timeout: 60000, // machine creation can take a bit so let's wait at least a minute.
      onData: () => {
        showToast({
          title: "Machine Created",
          message: "Machine has been successfully created.",
          style: Toast.Style.Success,
        });
        setMachine(null);
      },
      onError: (e) => {
        showToast({
          title: "Machine Creation Failed",
          message: e.message,
          style: Toast.Style.Failure,
        });
        setMachine(null);
      },
    },
  );

  const handleCreate = (values: CreateMachineFormValues) => {
    setMachine(values);
    showToast({
      title: "Creating Machine",
      message: "Please wait.",
      style: Toast.Style.Animated,
    });
  };

  const { handleSubmit, itemProps } = useForm<CreateMachineFormValues>({
    onSubmit: handleCreate,
    validation: {
      name: FormValidation.Required,
      distro: FormValidation.Required,
      arch: FormValidation.Required,
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
      <Form.Dropdown title="Arch" {...itemProps.arch}>
        {ARCHITECTURES.map((arch) => (
          <Form.Dropdown.Item key={arch.value} value={arch.value} title={arch.title} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
