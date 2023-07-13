/**
 * Defines the interface for STARLIMS enterprise services.
 */
export interface Enterprise {
  getEnterpriseItems(uri: string): any;
  getEnterpriseItemCode(uri: string): any;
  getLocalCopy(uri: string, workspaceFolder: string, returnCode: boolean): Promise<string | null>;
  getConfig(): any;
  saveEnterpriseItemCode(uri: string, code: string): any;
  runScript(uri: string): any;
  clearLog(uri: string): any;
  getEnterpriseItemUri(uri: string, rootPath: string): any;
  scrollToBottom(): any;
  searchForItems(searchText: string): any;
  runXFDForm(uri: string): any;
}
