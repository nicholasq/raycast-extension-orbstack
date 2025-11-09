export interface OrbMachine {
  id: string;
  name: string;
  image: {
    distro: string;
    version: string;
    arch: string;
    variant: string;
  };
  config: {
    isolated: boolean;
    default_username: string;
  };
  builtin: boolean;
  state: string;
}

export type Architecture = "arm64" | "amd64";
export type Distro =
  | "alma"
  | "alpine"
  | "arch"
  | "centos"
  | "debian"
  | "devuan"
  | "fedora"
  | "gentoo"
  | "kali"
  | "nixos"
  | "openeuler"
  | "opensuse"
  | "oracle"
  | "rocky"
  | "ubuntu"
  | "void";
