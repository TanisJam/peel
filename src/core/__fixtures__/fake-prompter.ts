import type { AutocompleteOption, Cancel, Prompter, SelectOption } from "../../ports/prompter.js";
import { CANCEL } from "../../ports/prompter.js";

export type ScriptStep =
  | { kind: "text"; value: string | Cancel }
  | { kind: "select"; value: string | Cancel }
  | { kind: "multiselect"; value: string[] | Cancel }
  | { kind: "confirm"; value: boolean | Cancel }
  | { kind: "autocomplete"; value: string | Cancel };

export class FakePrompter implements Prompter {
  private steps: ScriptStep[] = [];
  public readonly transcript: { kind: ScriptStep["kind"]; message: string }[] = [];
  public introCalls: string[] = [];
  public outroCalls: string[] = [];

  script(steps: ScriptStep[]): this {
    this.steps = [...steps];
    return this;
  }

  private next(kind: ScriptStep["kind"], message: string): unknown {
    this.transcript.push({ kind, message });
    const step = this.steps.shift();
    if (!step) {
      throw new Error(`FakePrompter script exhausted (no step for ${kind} prompt: "${message}")`);
    }
    if (step.kind !== kind) {
      throw new Error(
        `FakePrompter script mismatch: expected ${kind} but next step is ${step.kind} (prompt: "${message}")`,
      );
    }
    return step.value;
  }

  intro(message: string): void {
    this.introCalls.push(message);
  }

  outro(message: string): void {
    this.outroCalls.push(message);
  }

  async text(opts: { message: string }): Promise<string | Cancel> {
    return this.next("text", opts.message) as string | Cancel;
  }

  async select<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
  }): Promise<T | Cancel> {
    return this.next("select", opts.message) as T | Cancel;
  }

  async multiselect<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
  }): Promise<T[] | Cancel> {
    return this.next("multiselect", opts.message) as T[] | Cancel;
  }

  async confirm(opts: { message: string }): Promise<boolean | Cancel> {
    return this.next("confirm", opts.message) as boolean | Cancel;
  }

  async autocomplete<T extends string>(opts: {
    message: string;
    options: AutocompleteOption<T>[];
  }): Promise<T | Cancel> {
    return this.next("autocomplete", opts.message) as T | Cancel;
  }
}

export const cancelStep = (kind: ScriptStep["kind"]): ScriptStep =>
  ({ kind, value: CANCEL }) as ScriptStep;
