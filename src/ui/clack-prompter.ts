import * as clack from "@clack/prompts";
import { CANCEL, type Cancel, type Prompter, type SelectOption } from "../ports/prompter.js";

const toCancel = <T>(value: T | symbol): T | Cancel =>
  clack.isCancel(value) ? CANCEL : (value as T);

type ClackOptions<T> = Parameters<typeof clack.select<T>>[0]["options"];

export class ClackPrompter implements Prompter {
  intro(message: string): void {
    clack.intro(message);
  }

  outro(message: string): void {
    clack.outro(message);
  }

  async text(opts: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
  }): Promise<string | Cancel> {
    const result = await clack.text({
      message: opts.message,
      ...(opts.placeholder !== undefined ? { placeholder: opts.placeholder } : {}),
      ...(opts.defaultValue !== undefined ? { defaultValue: opts.defaultValue } : {}),
    });
    return toCancel(result as string | symbol);
  }

  async select<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
    initialValue?: T;
  }): Promise<T | Cancel> {
    const result = await clack.select({
      message: opts.message,
      options: opts.options as unknown as ClackOptions<T>,
      ...(opts.initialValue !== undefined ? { initialValue: opts.initialValue } : {}),
    });
    return toCancel(result as T | symbol);
  }

  async multiselect<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
    initialValues?: T[];
    required?: boolean;
  }): Promise<T[] | Cancel> {
    const result = await clack.multiselect({
      message: opts.message,
      options: opts.options as unknown as ClackOptions<T>,
      ...(opts.initialValues !== undefined ? { initialValues: opts.initialValues } : {}),
      required: opts.required ?? false,
    });
    return toCancel(result as T[] | symbol);
  }

  async confirm(opts: {
    message: string;
    initialValue?: boolean;
  }): Promise<boolean | Cancel> {
    const result = await clack.confirm({
      message: opts.message,
      ...(opts.initialValue !== undefined ? { initialValue: opts.initialValue } : {}),
    });
    return toCancel(result as boolean | symbol);
  }
}
