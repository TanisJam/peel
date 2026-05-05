export const CANCEL: unique symbol = Symbol.for("peel.cancel");
export type Cancel = typeof CANCEL;

export type SelectOption<T extends string> = { value: T; label: string };

export interface Prompter {
  intro(message: string): void;
  outro(message: string): void;

  text(opts: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
  }): Promise<string | Cancel>;

  select<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
    initialValue?: T;
  }): Promise<T | Cancel>;

  multiselect<T extends string>(opts: {
    message: string;
    options: SelectOption<T>[];
    initialValues?: T[];
    required?: boolean;
  }): Promise<T[] | Cancel>;

  confirm(opts: {
    message: string;
    initialValue?: boolean;
  }): Promise<boolean | Cancel>;
}

export function isCancel(value: unknown): value is Cancel {
  return value === CANCEL;
}
