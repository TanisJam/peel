import { describe, expect, it } from "vitest";
import { CANCEL } from "../ports/prompter.js";
import { FakePrompter } from "./__fixtures__/fake-prompter.js";
import { BranchNotFoundError, pickBranch } from "./branch-picker.js";
import type { Branch } from "./git.js";

const sampleBranches: Branch[] = [
  { name: "main", isRemote: false, committerDate: new Date("2026-05-01") },
  { name: "feature/x", isRemote: false, committerDate: new Date("2026-05-04") },
  { name: "feature/y", isRemote: true, committerDate: new Date("2026-05-03") },
];

describe("pickBranch", () => {
  it("returns the explicit branch when valid and skips the prompt", async () => {
    const prompter = new FakePrompter();
    const result = await pickBranch({
      prompter,
      branches: sampleBranches,
      explicit: "feature/x",
    });
    expect(result).toBe("feature/x");
    expect(prompter.transcript).toEqual([]);
  });

  it("throws BranchNotFoundError with did-you-mean suggestions for unknown explicit", async () => {
    const prompter = new FakePrompter();
    try {
      await pickBranch({
        prompter,
        branches: sampleBranches,
        explicit: "feature/z",
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BranchNotFoundError);
      const e = err as BranchNotFoundError;
      expect(e.suggestions).toContain("feature/x");
      expect(e.suggestions).toContain("feature/y");
    }
  });

  it("returns the picked branch via prompt", async () => {
    const prompter = new FakePrompter().script([{ kind: "select", value: "main" }]);
    const result = await pickBranch({ prompter, branches: sampleBranches });
    expect(result).toBe("main");
    expect(prompter.transcript[0]?.kind).toBe("select");
  });

  it("returns null when the user cancels the prompt", async () => {
    const prompter = new FakePrompter().script([{ kind: "select", value: CANCEL }]);
    const result = await pickBranch({ prompter, branches: sampleBranches });
    expect(result).toBeNull();
  });
});
