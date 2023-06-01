/**
 * Defines the interface for STARLIMS enterprise services.
 */
export interface Enterprise {
  getEnterpriseItem(uri: string): any;
  getEnterpriseItemCode(uri: string): any;
  getLocalCopy(uri: string, workspaceFolder: string): Promise<string | null>;
  getConfig(): any;
  runScript(uri: string): any;
}
