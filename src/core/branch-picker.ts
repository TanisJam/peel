import type { Prompter } from "../ports/prompter.js";
import { isCancel } from "../ports/prompter.js";
import type { Branch } from "./git.js";

export class BranchNotFoundError extends Error {
  constructor(
    message: string,
    public readonly suggestions: string[],
  ) {
    super(message);
    this.name = "BranchNotFoundError";
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[n] ?? 0;
}

function topSuggestions(name: string, branches: Branch[], limit = 3): string[] {
  return branches
    .map((b) => ({ name: b.name, distance: levenshtein(name, b.name) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.name);
}

export type PickBranchArgs = {
  prompter: Prompter;
  branches: Branch[];
  explicit?: string;
};

export async function pickBranch(args: PickBranchArgs): Promise<string | null> {
  if (args.explicit !== undefined) {
    const found = args.branches.find((b) => b.name === args.explicit);
    if (found) return found.name;
    throw new BranchNotFoundError(
      `Branch '${args.explicit}' not found locally or on origin.`,
      topSuggestions(args.explicit, args.branches),
    );
  }

  const choice = await args.prompter.autocomplete({
    message: "Pick a branch (type to filter)",
    placeholder: "Type to filter…",
    options: args.branches.map((b) => ({
      value: b.name,
      label: b.isRemote ? `${b.name} (origin)` : b.name,
    })),
  });
  if (isCancel(choice)) return null;
  return choice;
}
