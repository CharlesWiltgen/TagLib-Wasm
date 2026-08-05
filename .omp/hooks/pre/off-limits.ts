import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

/**
 * Hard block: the Poppy app repo is OFF LIMITS from this workspace.
 *
 * Blocks any path-bearing tool call (read, edit, write, glob, grep, bash,
 * task) whose inputs reference ~/Projects/Poppy — a path under it, a `cd`
 * into it, or a command touching it.
 *
 * Fail-open on handler bugs: an unexpected throw would otherwise block every
 * tool call (the wrapper is fail-closed by default). The deliberate block is
 * the only path that returns { block: true }.
 */
const POPPY_PATH = /(^|[/\\])Projects[/\\]Poppy(?![A-Za-z0-9._-])/;

const PATH_FIELDS = new Set(["path", "paths", "command", "cwd", "url"]);

function touchesPoppy(value: unknown): boolean {
  if (typeof value === "string") return POPPY_PATH.test(value);
  if (Array.isArray(value)) return value.some(touchesPoppy);
  return false;
}

export default function offLimitsPoppy(pi: HookAPI): void {
  pi.on("tool_call", async (event) => {
    try {
      if (!event.input) return;
      const input = event.input as Record<string, unknown>;
      const hit = Object.entries(input).some(
        ([key, value]) => PATH_FIELDS.has(key) && touchesPoppy(value),
      );
      if (!hit) return;
      return {
        block: true,
        reason:
          "Blocked by workspace policy: the Poppy repo (~/Projects/Poppy) is OFF LIMITS from this workspace. Ask the user first; Poppy work happens only in Poppy sessions.",
      };
    } catch {
      // Fail open on unexpected errors; never brick the session.
      return;
    }
  });
}
