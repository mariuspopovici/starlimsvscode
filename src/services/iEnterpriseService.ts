/**
 * Defines the interface for STARLIMS enterprise services.
 */
export interface IEnterpriseService {
  getEnterpriseItems(uri: string, bSilent: boolean): any;
  getEnterpriseItemCode(uri: string): any;
  getLocalCopy(uri: string, workspaceFolder: string, returnCode: boolean): Promise<string | null>;
  getConfig(): any;
  saveEnterpriseItemCode(uri: string, code: string): any;
  runScript(uri: string): any;
  clearLog(uri: string): any;
  getEnterpriseItemUri(uri: string, rootPath: string): any;
  scrollToBottom(): any;
  searchForItems(itemName: string, itemType: string): any;
  globalSearch(searchString: string, itemTypes: string): any;
  runXFDForm(uri: string): any;
  getGUID(uri: string): any;
  getTableCommand(uri: string, type: string): any;
  getUriFromLocalPath(localPath: string): any;
  getCheckedOutItems(): any;
  checkInAllItems(): any;
  getTableDefinition(uri: string): any;
  getVersion(): any;
  upgradeBackend(sdpPackage: string): any;
  isCheckedOut(uri: string): any;
  setCheckedOut(uri: string): any;
}
