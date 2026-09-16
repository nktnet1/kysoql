export interface CompiledSoql {
  readonly soql: string;
}

export interface SoqlQuery<Result> {
  compile(): CompiledSoql;
  readonly __result?: Result;
}

export const kysoql = () => ({
  version: "0.0.0",
});
