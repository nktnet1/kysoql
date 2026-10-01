import { styleText } from "node:util";

export const accent = (value: string): string => styleText("cyan", value);
export const success = (value: string): string => styleText("green", value);
export const warning = (value: string): string => styleText("yellow", value);
export const danger = (value: string): string => styleText("red", value);
export const strong = (value: string): string => styleText("bold", value);

export const step = (label: string): string => `${accent("==>")} ${label}`;

export const errorLine = (message: string): string =>
  `${danger("error")}: ${message}`;
