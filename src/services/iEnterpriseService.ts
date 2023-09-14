/**
 * Defines the interface for STARLIMS enterprise services.
 */
export interface IEnterpriseService {
  getEnterpriseItems(uri: string, bSilent: boolean): any;
  getEnterpriseItemCode(uri: string, language: string | undefined): any;
  getLocalCopy(uri: string, workspaceFolder: string, returnCode: boolean): Promise<string | null>;
  getConfig(): any;
  saveEnterpriseItemCode(uri: string, code: string, language: string): any;
  runScript(uri: string): any;
  clearLog(uri: string): any;
  getEnterpriseItemUri(uri: string, rootPath: string): any;
  scrollToBottom(): any;
  searchForItems(itemName: string, itemType: string, isExactMatch: boolean): any;
  globalSearch(searchString: string, itemTypes: string): any;
  runXFDForm(uri: string): any;
  getGUID(uri: string): any;
  getTableCommand(uri: string, type: string): any;
  getUriFromLocalPath(localPath: string): any;
  getCheckedOutItems(): any;
  checkInAllItems(reason: string | undefined): any;
  getTableDefinition(uri: string): any;
  getVersion(): any;
  upgradeBackend(sdpPackage: string): any;
  isCheckedOut(uri: string): any;
  setCheckedOut(uri: string, username: string | null): any;
}
