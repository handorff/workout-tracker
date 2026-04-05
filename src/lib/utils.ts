import { clsx } from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export function assertExists<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}
