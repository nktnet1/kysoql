export type ApexQueryContext = "static" | "dynamic";

export type DynamicApexOnly<
  Context extends ApexQueryContext,
  Value,
> = Context extends "dynamic" ? Value : never;
