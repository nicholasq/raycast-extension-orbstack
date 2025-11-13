import { Detail, ActionPanel, Action } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { ORB_CTL } from "./orbstack";

export default function ConfigShow() {
  const { data, isLoading, error, revalidate } = useExec(ORB_CTL, ["config", "show"]);

  if (error) {
    return (
      <Detail
        markdown={`# Configuration Error\n\nFailed to load configuration: ${error.message}`}
        actions={
          <ActionPanel>
            <Action
              title="Retry"
              onAction={() => {
                revalidate();
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Detail
      markdown={data ? `# OrbStack Configuration\n\`\`\`\n${data}\n\`\`\`\n` : "No configuration data found"}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            onAction={() => {
              revalidate();
            }}
          />
        </ActionPanel>
      }
    />
  );
}
