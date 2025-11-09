import { List, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useMemo, useState } from "react";
import { OrbMachine } from "./orbstack";
import { getStatusIcon } from "./utils";

type MachineState = "running" | "stopped" | "stopping";

class StateTransition {
  id: string;
  currentState: string;
  requestedState: MachineState;

  constructor(machine: OrbMachine, requestedState: MachineState) {
    this.id = machine.id;
    this.currentState = machine.state;
    this.requestedState = requestedState;
  }

  execute(): boolean {
    if (this.currentState === "stopped" && this.requestedState === "running") {
      return true;
    }
    if (this.currentState === "running" && this.requestedState === "stopped") {
      return true;
    }
    return false;
  }

  command(): string[] {
    if (this.requestedState === "running" && this.currentState === "stopped") {
      return ["start", this.id];
    } else if (this.requestedState === "stopped" && this.currentState === "running") {
      return ["stop", this.id];
    }
    return [];
  }
}

export default function Command() {
  const {
    data,
    isLoading: isLoadingList,
    revalidate,
  } = useExec("orbctl", ["list", "--format", "json"], {
    onError: (e) => {
      showToast({
        title: "Error",
        message: e.message,
        style: Toast.Style.Failure,
      });
    },
  });
  const [stateTransition, setStateTransition] = useState<StateTransition | null>(null);
  const { isLoading: machineTransitioning } = useExec("orbctl", stateTransition?.command() ?? [], {
    execute: stateTransition?.execute() ?? false,
    onData: () => {
      setStateTransition(null);
      revalidate();
    },
    onError: (e) => {
      setStateTransition(null);
      revalidate();
      showToast({
        title: "Error",
        message: e.message,
        style: Toast.Style.Failure,
      });
    },
  });

  const machines: OrbMachine[] = useMemo(() => {
    if (data) {
      return JSON.parse(data) as OrbMachine[];
    }
    return [];
  }, [data]);

  if (isLoadingList) {
    return <List isLoading={true}></List>;
  }

  return (
    <List isLoading={machineTransitioning}>
      {machines.map((machine) => (
        <List.Item
          key={machine.id}
          title={machine.name}
          subtitle={`${machine.image.distro} ${machine.image.version} (${machine.image.arch}) [${machine.state}]`}
          icon={getStatusIcon(machine.state)}
          actions={
            <ActionPanel>
              {machine.state === "running" ? (
                <Action
                  title="Stop Machine"
                  onAction={() => {
                    setStateTransition(new StateTransition(machine, "stopped"));
                    showToast({
                      title: "Stopping",
                      style: Toast.Style.Animated,
                    }).then((t) => {
                      setTimeout(() => {
                        t.hide();
                      }, 2000);
                    });
                  }}
                />
              ) : (
                <Action
                  title="Start Machine"
                  onAction={() => {
                    setStateTransition(new StateTransition(machine, "running"));
                    // Machines start nearly instantly so this toast almost seems unnecessary but I think it gives
                    // a little better UX since the user can clearly see their action was executed.
                    showToast({
                      title: "Starting",
                      style: Toast.Style.Animated,
                    }).then((t) => {
                      setTimeout(() => {
                        t.hide();
                      }, 1000);
                    });
                  }}
                />
              )}
              <Action
                title="Refresh"
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() => {
                  revalidate();
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
