import { describe, expect, it } from "vitest";
import { CANCEL, isCancel } from "../../ports/prompter.js";
import { FakePrompter } from "./fake-prompter.js";

describe("FakePrompter", () => {
  it("returns scripted answers in order", async () => {
    const p = new FakePrompter().script([
      { kind: "text", value: "hello" },
      { kind: "confirm", value: true },
    ]);

    expect(await p.text({ message: "name?" })).toBe("hello");
    expect(await p.confirm({ message: "ok?" })).toBe(true);
  });

  it("throws when the script is exhausted", async () => {
    const p = new FakePrompter().script([]);
    await expect(p.text({ message: "x" })).rejects.toThrow(/exhausted/);
  });

  it("throws on kind mismatch", async () => {
    const p = new FakePrompter().script([{ kind: "confirm", value: true }]);
    await expect(p.text({ message: "x" })).rejects.toThrow(/mismatch/);
  });

  it("propagates the cancel sentinel", async () => {
    const p = new FakePrompter().script([{ kind: "text", value: CANCEL }]);
    const result = await p.text({ message: "x" });
    expect(isCancel(result)).toBe(true);
  });

  it("returns the scripted autocomplete value", async () => {
    const p = new FakePrompter().script([{ kind: "autocomplete", value: "feature/x" }]);
    const result = await p.autocomplete({
      message: "Pick a branch",
      options: [
        { value: "feature/x", label: "feature/x" },
        { value: "feature/y", label: "feature/y" },
      ],
    });
    expect(result).toBe("feature/x");
  });

  it("throws on autocomplete kind mismatch", async () => {
    const p = new FakePrompter().script([{ kind: "select", value: "x" }]);
    await expect(
      p.autocomplete({ message: "m", options: [{ value: "x", label: "x" }] }),
    ).rejects.toThrow(/mismatch/);
  });

  it("propagates the cancel sentinel from autocomplete", async () => {
    const p = new FakePrompter().script([{ kind: "autocomplete", value: CANCEL }]);
    const result = await p.autocomplete({
      message: "m",
      options: [{ value: "x", label: "x" }],
    });
    expect(isCancel(result)).toBe(true);
  });

  it("records a transcript and intro/outro calls", async () => {
    const p = new FakePrompter().script([{ kind: "text", value: "v" }]);
    p.intro("hi");
    await p.text({ message: "name?" });
    p.outro("bye");
    expect(p.introCalls).toEqual(["hi"]);
    expect(p.outroCalls).toEqual(["bye"]);
    expect(p.transcript).toEqual([{ kind: "text", message: "name?" }]);
  });
});
