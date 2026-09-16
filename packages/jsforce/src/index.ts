export interface JsforceExecutor {
  query<Result>(soql: string): Promise<readonly Result[]>;
}

export const createJsforceExecutor = (executor: JsforceExecutor): JsforceExecutor => executor;
