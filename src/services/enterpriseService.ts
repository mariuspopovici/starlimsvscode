/* eslint-disable @typescript-eslint/naming-convention */
import fetch from "node-fetch";
import { Headers } from "node-fetch";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Enterprise } from "./enterprise";
import { connectBridge } from "../utilities/bridge";
import { cleanUrl } from "../utilities/miscUtils";

/**
 * STARLIMS Enterprise Designer service. Provides main services for the VS Code extensions,
 * at time using the SCM_API REST services in STARLIMS backed.
 */
export class EnterpriseService implements Enterprise {
  private config: any;
  private baseUrl: string;
  private refreshSessionInterval: NodeJS.Timeout | undefined;
  private SLVSCODE_FOLDER: string = "SLVSCODE";

  /**
   * Constructor
   * @param config Workspace config object for the STARLIMS VS Code extension.
   */
  constructor(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this.baseUrl = cleanUrl(config.url);
  }

  /**
   * Deploys the current version of the SCM_API.sdp on the STARLIMS server.
   */
  async upgradeBackend(sdpPackage: string) {
    const url = `${this.baseUrl}/SCM_API.ImportPackage.lims`;
    let stats: fs.Stats;
    try {
      stats = fs.statSync(sdpPackage);
    } catch (e) {
      vscode.window.showErrorMessage("Cannot access SCM_API.sdp");
      return;
    }
    const readStream = fs.createReadStream(sdpPackage);

    const headers = new Headers([
      ["STARLIMSUser", this.config.user],
      ["STARLIMSPass", this.config.password],
      ["Accept", "*/*"],
      ["Accept-Encoding", "gzip, deflate, br"],
      ["Content-length", stats.size.toString()]
    ]);

    const options: any = {
      method: "POST",
      headers,
      body: readStream
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("STARLIMS VS Code backend API upgraded successfully.");
      } else {
        const outputChannel = vscode.window.createOutputChannel("STARLIMS");
        outputChannel.appendLine(data);
        outputChannel.show();
        vscode.window.showErrorMessage("Backend API import ended with errors. See output for details.");
      }
      return data instanceof Object ? JSON.stringify(data) : data;
    } catch (e: any) {
      vscode.window.showErrorMessage("Failed to execute HTTP call to remote service.");
      console.error(e);
      return;
    }
  }

  /**
   * Gets the extension backend API version.
   */
  async getVersion(): Promise<any> {
    const url = `${this.baseUrl}/SCM_API.Version.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return null;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not retrieve API version.");
      console.error(e);
      return null;
    }
  }

  /**
   * Gets the table schema definition from STARLIMS
   * @param uri the URI of the table item
   */
  async getTableDefinition(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.TableDefinition.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());

    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        const newData = [
          ["Field Name", "Caption", "Data Type", "Field Size", "Allow Nulls", "Default", "Notes", "Sorter"],
          ...data
        ];
        return JSON.stringify(newData, null, 2);
      } else {
        vscode.window.showErrorMessage("Could not retrieve table definition.");
        console.log(data);
        return null;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve table definition.");
      return null;
    }
  }

  /**
   * Gets a SQL command for the specified table.
   * @param uri
   */
  async getTableCommand(uri: string, type: string) {
    const params = new URLSearchParams([
      ["URI", uri],
      ["CommandType", type]
    ]);
    const url = `${this.baseUrl}/SCM_API.TableCommand.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());

    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage("Could not retrieve table command.");
        console.log(data);
        return null;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve table command.");
      return null;
    }
  }

  /**
   * Add a new enterprise item to the specified folder
   * @param itemName the name of the new item
   * @param itemType the type of the new item
   * @param language the language of the new item
   */
  async addItem(itemName: string, itemType: string, language: string, categoryName: string, appName: string) {
    const url = `${this.baseUrl}/SCM_API.Add.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "POST",
      headers,
      body: JSON.stringify({
        ItemName: itemName,
        ItemType: itemType,
        Language: language,
        Category: categoryName,
        AppName: appName
      })
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Item added successfully.");
      } else {
        vscode.window.showErrorMessage(data);
      }
      return data instanceof Object ? JSON.stringify(data) : data;
    } catch (e: any) {
      vscode.window.showErrorMessage("Failed to execute HTTP call to remote service.");
      console.error(e);
      return;
    }
  }

  /**
   * Execute script remotely.
   * @param uri the URI of the remote script.
   */
  async runScript(uri: string) {
    const url = `${this.baseUrl}/SCM_API.RunScript.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "POST",
      headers,
      body: JSON.stringify({
        URI: uri
      })
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      return {
        success: success,
        data: data instanceof Object ? JSON.stringify(data, null, 2) : data
      };
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Failed to execute HTTP call to remote service.");
      return {
        success: false,
        data: "An unexpected error ocurred while calling remote service."
      };
    }
  }

  /**
   * Gets the service config
   * @returns the service configuration settings */
  public getConfig(): vscode.WorkspaceConfiguration {
    return this.config;
  }

  /**
   * Gets all enterprise items below the specified URI.
   * @param uri the URI of the remote STARLIMS code item.
   * @returns A descriptor object with the following properties: name, type, uri, language, isFolder
   */
  public async getEnterpriseItems(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.GetEnterpriseItems.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data.items;
      } else {
        vscode.window.showErrorMessage("Could not retrieve enterprise items.");
        console.log(data);
        return [];
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve enterprise items.");
      return [];
    }
  }

  /**
   * Gets the code and code language (XML, JS, SSL, SLSQL etc.) of the STARLIMS Enterprise Designer referenced
   * by the specified URI.
   * @param uri the URI of the remote STARLIMS script / code item.
   * @returns an object with Language: string and Code: string
   */
  public async getEnterpriseItemCode(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.GetCode.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        if (data.language === "JS") {
          // comment out all occurences of '#include' in order for eslint to work
          data.code = data.code.replace(/^#include/gm, "//#include");
        }
        return data;
      } else {
        vscode.window.showErrorMessage("Could not retrieve item code.");
        console.log(data);
        return null;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve item code.");
      return null;
    }
  }

  /**
   * Checks out the specified STARLIMS Enterprise Designer item.
   * @param uri  the URI of the remote STARLIMS script / code item.
   * @returns  true if the item was checked out successfully, false otherwise.
   */
  public async CheckOut(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.CheckOut.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success }: { success: boolean } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Enterprise item checked out successfully.");
        return true;
      } else {
        vscode.window.showErrorMessage("Could not check out enterprise item.");
        return false;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not check out enterprise item.");
      return false;
    }
  }

  /**
   * Checks in the specified STARLIMS Enterprise Designer item.
   * @param uri the URI of the remote STARLIMS script / code item.
   * @param reason the reason for checking in the item.
   * @returns true if the item was checked in successfully, false otherwise.
   */
  public async CheckIn(uri: string, reason: string) {
    // check for empty uri
    if (!uri) {
      vscode.window.showErrorMessage("Could not check in enterprise item. Missing URI.");
      return false;
    }
    const params = new URLSearchParams([
      ["URI", uri],
      ["Reason", reason]
    ]);
    const url = `${this.baseUrl}/SCM_API.CheckIn.lims?${params}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success }: { success: boolean } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Enterprise item checked in successfully.");
        return true;
      } else {
        vscode.window.showErrorMessage("Could not check in enterprise item.");
        return false;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not check in enterprise item.");
      return false;
    }
  }

  /**
   * Downloads the specified STARLIMS enterprise designer item to a local workspace folder.
   * @param uri the URI to the remote script / code item
   * @param workspaceFolder the local workspace folder where to download the file
   * @param returnCode if true, the function will return the code as a string instead of the local file path
   * @returns the local file path if returnCode is false, otherwise the code as a string
   */
  public async getLocalCopy(uri: string, workspaceFolder: string, returnCode: boolean = false): Promise<string | null> {
    const item = await this.getEnterpriseItemCode(uri);
    if (item) {
      // create local file path
      const localFilePath = path.join(workspaceFolder, `${uri}.${item.language.toLowerCase().replace("sql", "slsql")}`);

      try {
        // create local folder if it does not exist
        const localFolder = path.dirname(localFilePath);
        fs.mkdirSync(localFolder, { recursive: true });

        // comment out all occurences of '#include' for eslint to work
        item.code = item.code.replace(/^#include/gm, "//#include");

        fs.writeFileSync(localFilePath, item.code, {
          encoding: "utf8"
        });

        if (returnCode) {
          return item.code;
        } else {
          return localFilePath;
        }
      } catch (e) {
        vscode.window.showErrorMessage(`Cannot write file ${localFilePath}.`);
        console.error(e);
      }
    }
    return null;
  }

  /**
   * Saves the code of the STARLIMS Enterprise Designer item referenced by the specified URI.
   * @param uri The URI of the remote STARLIMS script / code item.
   * @param code The code to save.
   */
  public async saveEnterpriseItemCode(uri: string, code: string) {
    // uncomment all occurences of '#include'
    code = code.replace(/^\/\/#include/gm, "#include");
    const url = `${this.baseUrl}/SCM_API.SaveCode.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "POST",
      headers,
      body: JSON.stringify({
        URI: uri,
        Code: code
      })
    };
    // execute transaction
    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Code saved successfully.");
      } else {
        vscode.window.showErrorMessage(data);
      }
      return data instanceof Object ? JSON.stringify(data) : data;
    } catch (e: any) {
      vscode.window.showErrorMessage("Failed to execute HTTP call to remote service.");
      console.error(e);
      return;
    }
  }

  /**
   * Get API headers for HTTP calls to STARLIMS.
   * @returns an array of string arrays with header name and value.
   */
  private getAPIHeaders(): string[][] {
    return [
      ["STARLIMSUser", this.config.user],
      ["STARLIMSPass", this.config.password],
      ["Content-Type", "application/json"],
      ["Accept", "*/*"]
    ];
  }

  /**
   * Clear log file of selected user
   * @param uri the URI of the log file item.
   * @returns true if the log file was cleared successfully, false otherwise
   */
  public async clearLog(uri: string) {
    const user = uri.split("/")[2];
    const url = `${this.baseUrl}/SCM_API.ClearLog.lims?User=${user}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Log file cleared successfully.");

        // close log file if it is open (check by file name)
        const logFileName = `${user}.log`;
        const logFile = vscode.workspace.textDocuments.find((doc) => doc.fileName.endsWith(logFileName));
        if (logFile) {
          await vscode.window.showTextDocument(logFile);
          await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }

        return true;
      } else {
        vscode.window.showErrorMessage("Could not clear log file.");
        console.error(data);
        return false;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not clear log file.");
      console.error(e);
      return false;
    }
  }

  /**
   * Get the uri of an enterprise item by its file path
   * @param filePath the file path of the enterprise item
   * @returns the uri of the enterprise item
   */
  public getEnterpriseItemUri(filePath: string, rootPath: string): string {
    // remove leading 'starlims:///' from file path
    var filePath = filePath.replace(/^starlims:\/\/\//, "");

    // replace backslashes with forward slashes on root path
    rootPath = rootPath.replace(/\\/g, "/");

    // remove trailing slash from file path
    filePath = filePath.replace(/\/$/, "");

    // remove file extension
    filePath = filePath.replace(/\.[^/.]+$/, "");

    // remove workspace folder path from file path
    filePath = filePath.replace(new RegExp(rootPath, "ig"), "");
    return filePath;
  }

  /**
   * Scroll to the bottom of the active text editor
   */
  public async scrollToBottom() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const position = editor.document.lineAt(editor.document.lineCount - 1).range.end;
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    }
  }

  /**
   * Search enterprise items by its name (and type)
   * @param itemName the name of the enterprise item
   * @param itemType the type of the enterprise item
   * @returns the enterprise item found
   */
  public async searchForItems(itemName: string, itemType: string): Promise<any> {
    let url = `${this.baseUrl}/SCM_API.Search.lims?&itemName=${itemName}`;
    if (itemType !== "") {
      url += `&itemType=${itemType}`;
    }
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data.items;
      } else {
        vscode.window.showErrorMessage("Item not found.");
        console.error(data);
        return [];
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Item not found.");
      console.error(e);
      return [];
    }
  }

  /**
   * Global search for items by occuring text
   * @param searchString the text to search for
   * @returns the enterprise items found
   */
  public async globalSearch(searchString: string): Promise<any> {
    const url = `${this.baseUrl}/SCM_API.GlobalSearch.lims?&searchString=${searchString}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data.items;
      } else {
        vscode.window.showErrorMessage("No items found!");
        console.error(data);
        return [];
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("No items found!");
      console.error(e);
      return [];
    }
  }
  
  /**
   * Delete enterprise item
   * @param uri the URI of the enterprise item
   * @returns true if the item was deleted successfully, false otherwise
   */
  public async deleteItem(uri: string) {
    const url = `${this.baseUrl}/SCM_API.Delete.lims?URI=${uri}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Item deleted successfully.");
        return true;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return false;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not delete item.");
      console.error(e);
      return false;
    }
  }

  /**
   * Launches an XFD form via the STARLIMS HTML bridge.
   *
   * @param uri the URI of the enterprise item
   * @returns the form return value
   */
  public async runXFDForm(uri: string) {
    const isBridgeUp = await this.connectStarlimsBridge();
    if (!isBridgeUp) {
      vscode.window.showErrorMessage("STARLIMS bridge is not running.");
      return;
    }

    const sessionInfo = await this.getServerSessions();
    if (!sessionInfo) {
      return false;
    }

    // start a session refresh task otherwise the current session
    // will expire in 2 minutes

    const uriComponents = uri.split("/").slice(-4);
    const [appName, , , formName] = uriComponents;
    const bridgeURL = `http://localhost:5468/xfdforms/${appName}/${formName}`;
    const starlimsUrl = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const bridgeRequestBody = {
      webAddress: starlimsUrl,
      "aspnet-sessionid": sessionInfo.aspnetsessionid,
      "starlims-sessionid": sessionInfo.starlimssessionid,
      langid: sessionInfo.langid,
      needsGUID: true,
      formParameters: []
    };

    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "POST",
      headers,
      body: JSON.stringify(bridgeRequestBody)
    };

    try {
      const response = await fetch(bridgeURL, options);
      await response.text();
    } catch (e: any) {
      vscode.window.showErrorMessage("Failed to execute HTTP call to remote service.");
      console.error(e);
      return false;
    }

    return true;
  }

  /**
   * Gets the STARLIMS application session IDs from server.
   *
   * @returns object with ```aspnetsessionid``` and ```starlimssessionid```
   */
  private async getServerSessions() {
    const url = `${this.baseUrl}/SCM_API.GetSessions.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return null;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not retrieve STARLIMS session info.");
      console.error(e);
      return null;
    }
  }

  /**
   * Attempts to connect to the STARLIMS bridge and starts a session refresh
   * task if successful.
   *
   * @returns ```true``` if the STARLIMS bridge is up and ```false``` otherwise
   */
  private async connectStarlimsBridge() {
    if (this.refreshSessionInterval) {
      clearInterval(this.refreshSessionInterval);
    }

    const result = await connectBridge();
    if (result) {
      const _this = this;
      this.refreshSessionInterval = setInterval(() => {
        console.log("Refreshing bridge session.");
        _this.getServerSessions();
      }, 90 * 1000);
    }

    return result;
  }

  /**
   * Gets the GUID of the specified enterprise item from the server.
   *
   * @param uri the URI of the enterprise item
   * @returns the GUID of the enterprise item
   */
  public async getGUID(uri: string): Promise<string | null> {
    const url = `${this.baseUrl}/SCM_API.GetItemGUID.lims?URI=${uri}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return null;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not get GUID.");
      console.error(e);
      return null;
    }
  }

  /**
   * Get uri from local path for documents opened in the editor
   * @param localPath the local path of the enterprise item
   * @returns the uri of the enterprise item
   * */
  public getUriFromLocalPath(localPath: string): string {
    const uri = localPath ? localPath.slice(0, localPath.lastIndexOf(".")) : undefined;
    if (!uri) {
      return "";
    }
    let remotePath = uri.slice(uri.lastIndexOf(this.SLVSCODE_FOLDER) + this.SLVSCODE_FOLDER.length);
    return remotePath;
  }

  /**
   * Get checked out items
   * @returns the checked out items
   */
  public async getCheckedOutItems(bAllUsers: boolean = false) {
    const url = `${this.baseUrl}/SCM_API.GetCheckedOutItems.lims${bAllUsers ? "?allUsers=true" : ""}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage("Could not retrieve checked out items.");
        console.log(data);
        return [];
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve checked out items.");
      return [];
    }
  }

  /**
   * Check in all checked out items
   * @returns true if all items were checked in successfully, false otherwise
   */
  public async checkInAllItems() {
    const url = `${this.baseUrl}/SCM_API.CheckInAll.lims`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("All items checked in successfully.");
        return true;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return false;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not check in all items.");
      console.error(e);
      return false;
    }
  }

  /**
   * Undo check out of enterprise item
   * @param uri the URI of the enterprise item
   * @returns true if the item was checked in successfully, false otherwise
   */
  public async undoCheckOut(uri: string) {
    const url = `${this.baseUrl}/SCM_API.UndoCheckOut.lims?URI=${uri}`;
    const headers = new Headers(this.getAPIHeaders());
    const options: any = {
      method: "GET",
      headers
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } = await response.json();
      if (success) {
        vscode.window.showInformationMessage("Check out of item undone successfully.");
        return true;
      } else {
        vscode.window.showErrorMessage(data);
        console.error(data);
        return false;
      }
    } catch (e: any) {
      vscode.window.showErrorMessage("Could not undo check out of item.");
      console.error(e);
      return false;
    }
  }
}
