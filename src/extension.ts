"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { EnterpriseFileDecorationProvider } from "./providers/enterpriseFileDecorationProvider";
import { EnterpriseItemType, EnterpriseTreeDataProvider, TreeEnterpriseItem } from "./providers/enterpriseTreeDataProvider";
import { EnterpriseService } from "./services/enterpriseService";
import { EnterpriseTextDocumentContentProvider } from "./providers/enterpriseTextContentProvider";
import path = require("path");
import { DataViewPanel } from "./panels/DataViewPanel";
import { cleanUrl } from "./utilities/miscUtils";
import { exec } from "child_process";
import * as qs from 'querystring';

const SLVSCODE_FOLDER = "SLVSCODE";

export async function activate(context: vscode.ExtensionContext) {
  let config = vscode.workspace.getConfiguration("STARLIMS");
  let user: string | undefined = config.get("user");
  let password: string | undefined = config.get("password");
  let url: string | undefined = config.get("url");
  let rootPath: string | undefined = config.get("rootPath");
  let reloadConfig = false;
  let selectedItem: TreeEnterpriseItem | undefined;

  // ensure STARLIMS URL is defined and prompt for value if not
  if (!url) {
    url = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: "Enter STARLIMS URL",
      ignoreFocusOut: true,
    });
    if (url) {
      await config.update("url", url, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure STARLIMS URL in extension settings."
      );
      return;
    }
  }

  // ensure user and password are defined and prompt for values if not
  if (!user) {
    user = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: "Enter STARLIMS Username",
      ignoreFocusOut: true,
    });
    if (user) {
      await config.update("user", user.toUpperCase(), false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure STARLIMS user in extension settings."
      );
    }
  }

  if (!password) {
    password = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: `Enter Password for STARLIMS User '${user}'`,
      password: true,
      ignoreFocusOut: true,
    });
    if (password) {
      await config.update("password", password, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure STARLIMS password in extension settings."
      );
    }
  }

  // ensure base path is defined and prompt for value if not
  if (!rootPath) {
    let newRootPath = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: "Enter STARLIMS Root Path",
      ignoreFocusOut: true,
    });
    if (newRootPath) {
      await config.update("rootPath", newRootPath, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure STARLIMS root path in extension settings."
      );
      return;
    }
  }

  rootPath = path.join(config.get("rootPath") as string, SLVSCODE_FOLDER);

  // reload the configuration if it was updated
  if (reloadConfig) {
    config = vscode.workspace.getConfiguration("STARLIMS");
  }

  // create the enterprise service
  const enterpriseService = new EnterpriseService(config);

  // create the output channel for the extension
  const outputChannel = vscode.window.createOutputChannel("STARLIMS");

  // register a text content provider to viewing remote code items. it responds to the starlims:/ URI
  const enterpriseTextContentProvider =
    new EnterpriseTextDocumentContentProvider(enterpriseService);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "starlims",
      enterpriseTextContentProvider
    )
  );

  // register a custom tree data provider for the STARLIMS enterprise designer explorer
  const enterpriseProvider = new EnterpriseTreeDataProvider(enterpriseService);
  vscode.window.registerTreeDataProvider("STARLIMS", enterpriseProvider);

  // register a decoration provider for the STARLIMS enterprise tree
  const fileDecorationProvider = new EnterpriseFileDecorationProvider();
  vscode.window.registerFileDecorationProvider(fileDecorationProvider);

  // execute the STARLIMS.Save command when a document is saved
  vscode.workspace.onDidSaveTextDocument(
    async (document: vscode.TextDocument) => {
      // check if the document is in the configured workspace
      if (rootPath && document.uri.fsPath.toLowerCase().startsWith(rootPath.toLowerCase())) {
        vscode.commands.executeCommand("STARLIMS.Save", document.uri);
      }
    }
  );

  // this command activates the extension
  vscode.commands.registerCommand("STARLIMS.Connect", () => { });

  // register the selectEnterpriseItem command
  vscode.commands.registerCommand(
    "STARLIMS.selectEnterpriseItem",
    async (item: TreeEnterpriseItem) => {
      // check if item is TreeEnterpriseItem
      if (!(item instanceof TreeEnterpriseItem)) {
        // if not, get the item from the tree data provider
        item = enterpriseProvider.getTreeItemForDocument(
          item
        ) as TreeEnterpriseItem;
      }

      // set the selected item
      selectedItem = item;

      // open leaf nodes only
      if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
        return;
      }

      // check if the item is already open, switch the tab if it is
      const openDocument = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.fsPath.toLowerCase() === item.filePath?.toLowerCase()
      );
      if (openDocument) {
        // reload document, if it is a log file
        if (openDocument.uri.toString().endsWith(".log")) {
          // get the remote URI
          const remoteUri = enterpriseService.getEnterpriseItemUri(
            item.uri,
            rootPath!
          );

          // update local copy
          await enterpriseService.getLocalCopy(remoteUri, rootPath!);

          // show the document
          await vscode.window.showTextDocument(openDocument);

          setReadWrite(item);

          // scroll to bottom of document
          enterpriseService.scrollToBottom();
        } else {
          // other file types, just show the document
          await vscode.window.showTextDocument(openDocument);
        }
      } else {
        // get local copy of the item
        const localFilePath = await enterpriseService.getLocalCopy(
          item.uri,
          rootPath!
        );

        // open the item locally
        if (localFilePath) {
          item.filePath = localFilePath;
          let localUri: vscode.Uri = vscode.Uri.file(localFilePath);
          await vscode.window.showTextDocument(localUri, { preview: false });

          setReadWrite(item);

          // scroll to bottom of log files
          if (localUri.toString().endsWith(".log")) {
            enterpriseService.scrollToBottom();
          }
        }
      }
    }
  );

  // register the GetLocal command handler
  vscode.commands.registerCommand(
    "STARLIMS.GetLocal",
    async (item: TreeEnterpriseItem | any) => {
      // get local copy of the item
      const localFilePath = await enterpriseService.getLocalCopy(
        item.uri ||
        (item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined),
        rootPath!
      );
      if (localFilePath) {
        let uri: vscode.Uri = vscode.Uri.file(localFilePath);
        await vscode.window.showTextDocument(uri);
        await setReadWrite(item);
      }
    }
  );

  // set document to read only if item is not checked out and vice versa (requires vscode insiders)
  async function setReadWrite(item: TreeEnterpriseItem) {
    // check if the commands are available (VSCode version >= 1.79 (May 2023))
    // see https://code.visualstudio.com/updates/v1_79#_readonly-mode
    if (!(await vscode.commands.getCommands()).includes("workbench.action.files.setActiveEditorReadonlyInSession")) {
      return;
    }

    // check if the item is checked out by the current user
    if (item.checkedOutBy === user) {
      vscode.commands.executeCommand(
        "workbench.action.files.resetActiveEditorReadonlyInSession"
      );
    }
    else {
      vscode.commands.executeCommand(
        "workbench.action.files.setActiveEditorReadonlyInSession"
      );
      vscode.window.showInformationMessage("Please check out the item to make changes.");
    }
  }

  // register the RunScript command handler
  vscode.commands.registerCommand(
    "STARLIMS.RunScript",
    async (item: TreeEnterpriseItem | any) => {
      let remoteUri: string = "";

      // commands can originate from the enterprise tree or from an open editor window
      const isTreeCommand = item instanceof TreeEnterpriseItem;

      if (isTreeCommand) {
        remoteUri = item.uri;
      } else {
        // command originates from a document context menu
        const uri = item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined;
        if (config.has("rootPath")) {
          const remotePath = uri.slice(uri.lastIndexOf(SLVSCODE_FOLDER) + SLVSCODE_FOLDER.length);
          remoteUri = vscode.Uri.parse(`starlims://${remotePath}`).toString();
        }
      }

      outputChannel.appendLine(
        `${new Date().toLocaleString()} Executing remote script at URI: ${remoteUri}`
      );

      const result = await enterpriseService.runScript(remoteUri.toString());
      if (result) {
        outputChannel.appendLine(result);
        outputChannel.show();
      }
    }
  );

  // register the remote compare command
  vscode.commands.registerCommand(
    "STARLIMS.Compare",
    async (uri: vscode.Uri) => {
      // command executed on the item tree
      let localUri = uri;
      if (!localUri) {
        // if not, compare with the open document
        let editor = vscode.window.activeTextEditor;
        if (editor) {
          localUri = editor.document.uri;
        }
      }

      if (localUri) {
        if (config.has("rootPath")) {
          const rootPath: string = path.join(
            config.get("rootPath") as string,
            SLVSCODE_FOLDER
          );
          let remotePath = localUri.path.slice(rootPath.length);
          let remoteUri = vscode.Uri.parse(`starlims://${remotePath}`);
          vscode.commands.executeCommand("vscode.diff", remoteUri, localUri);
        } else {
          vscode.window.showErrorMessage(
            "STARLIMS: Working folder not found, open a workspace folder an try again."
          );
        }
      }
    }
  );

  // register the checkout command
  vscode.commands.registerCommand(
    "STARLIMS.Checkout",
    async (item: TreeEnterpriseItem) => {
      let bSuccess = await enterpriseService.CheckOut(item.uri);
      if (bSuccess) {
        item.checkedOutBy = user;
        enterpriseProvider.refresh();

        // execute getlocal command
        vscode.commands.executeCommand("STARLIMS.GetLocal", item);
      }
    }
  );

  // register the check in command
  vscode.commands.registerCommand(
    "STARLIMS.Checkin",
    async (item: TreeEnterpriseItem) => {
      let checkinReason: string =
        (await vscode.window.showInputBox({
          prompt: "Enter checkin reason",
          ignoreFocusOut: true,
        })) || "Checked in from VSCode";

      let bSuccess = await enterpriseService.CheckIn(item.uri, checkinReason);
      if (bSuccess) {
        item.checkedOutBy = "";
        enterpriseProvider.refresh();
        setReadWrite(item);
      }
    }
  );

  // register the refresh command
  vscode.commands.registerCommand(
    "STARLIMS.Refresh",
    async (item: TreeEnterpriseItem) => {
      enterpriseProvider.refresh();
    }
  );

  // register the showTreeView command
  vscode.commands.registerCommand(
    "STARLIMS.ShowTreeView",
    async (item: TreeEnterpriseItem) => {
      enterpriseProvider.refresh();
    }
  );
  // register the save file command
  vscode.commands.registerCommand(
    "STARLIMS.Save",
    async (item: TreeEnterpriseItem) => {
      const rootPath: string = path.join(
        config.get("rootPath") as string,
        SLVSCODE_FOLDER
      );
      const editor = vscode.window.activeTextEditor;

      if (editor && rootPath) {
        var localUri = editor.document.uri;
        if (localUri) {
          let remotePath = localUri.path.slice(rootPath.length + 1);
          enterpriseService.saveEnterpriseItemCode(remotePath, editor.document.getText());
        }
      }
    }
  );

  // register the clear log command
  vscode.commands.registerCommand("STARLIMS.ClearLog",
    async (item: TreeEnterpriseItem) => {
      // ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to clear the log for ${item.label}?`,
        { modal: true },
        "Yes"
      );
      if (confirm !== "Yes") {
        return;
      }
      enterpriseService.clearLog(item.uri);
    }
  );

  // register the search command
  vscode.commands.registerCommand("STARLIMS.Search",
    async (item: TreeEnterpriseItem) => {
      // ask for search text
      const itemName = await vscode.window.showInputBox({
        prompt: "Enter search text",
        ignoreFocusOut: true
      });
      if (!itemName) {
        return;
      }
      await enterpriseProvider.search(itemName);
    }
  );

  // register the open form command
  vscode.commands.registerCommand("STARLIMS.OpenForm",
    async (item: TreeEnterpriseItem | any) => {
      
      // TODO: service call to obtain the form GUID when the form command is executed from the editor 
      if (item.guid === undefined) {
        //item.guid = await enterpriseService.getFormGuid(remoteUri);
        return;
      }

      // open form in default browser
      const formUrl = `${cleanUrl(config.url)}/starthtml.lims?FormId=${item.guid.toLowerCase()}&Debug=true`;
      vscode.env.openExternal(vscode.Uri.parse(formUrl));
    }
  );

  // register the start debugging command
  vscode.commands.registerCommand("STARLIMS.DebugForm",
    async (item: TreeEnterpriseItem) => {
      // get guid for the form
      if (item.guid === undefined) {
        return;
        //item.guid = await enterpriseService.getFormGuid(item.uri);
      }

      // read STARLIMS.browser configuration value (edge or chrome)
      const browserType = config.get("browser") as string;

      // check if vscode debugger is already running
      const debuggerRunning = vscode.debug.activeDebugSession !== undefined;

      var debugConfig;
      if (!debuggerRunning) {
        // launch browser in debug mode
        debugConfig = {
          type: browserType,
          name: "Launch STARLIMS Debugging",
          request: "launch",
          url: `${cleanUrl(config.url)}/starthtml.lims?FormId=${item.guid.toLowerCase()}&Debug=true`,
          webRoot: rootPath,
          userDataDir: path.join(context.globalStorageUri.fsPath, "edge"),
          runtimeArgs: [
            "--remote-debugging-port=9222",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-popup-blocking",
            "--disable-translate",
            "--disable-session-crashed-bubble"
          ]
        };
      }
      else {
        // check if the url is already open in debugger
        const debuggerAttached = vscode.debug.activeDebugSession?.name.includes(`FormId=${item.guid.toLowerCase()}`);

        // if not, attach new debug session to the browser
        if (!debuggerAttached) {
          debugConfig = {
            type: browserType,
            name: "Attach to STARLIMS Debugging",
            request: "attach",
            url: `${cleanUrl(config.url)}/starthtml.lims?FormId=${item.guid.toLowerCase()}&Debug=true`,
            webRoot: rootPath,
            userDataDir: path.join(context.globalStorageUri.fsPath, "edge"),
            port: 9222
          };
        }
      }

      if (debugConfig) {
        // start new vscode debugger
        await vscode.debug.startDebugging(undefined, debugConfig);
      }

      // get the form script name
      const appName = item.uri.split("/")[3];
      const fileName = item.uri.split("/").pop() + ".js";
      const scriptName = `${appName}.${fileName}`;

      // wait until the form script has been loaded
      let formScript = await new Promise<any>(resolve => {
        var counter = 0;
        const interval = setInterval(async () => {
          // get debug protocol source from vscode loaded scripts
          const loadedScripts = await vscode.debug.activeDebugSession?.customRequest("loadedSources");

          // parse the array to find the script
          const script = loadedScripts?.sources.find((script: any) => script.name.includes(scriptName));

          // script found, resolve the promise
          if (script) {
            clearInterval(interval);
            resolve(script);
          }

          // if the script is not loaded after 1 minute, stop the interval and return undefined
          if (counter++ > 59) {
            clearInterval(interval);
            resolve(undefined);
          }
          counter++;
        }, 1000);
      });

      // script not found, abort
      if (!formScript) {
        vscode.window.showErrorMessage(`Could not find script ${scriptName} in the debugger. Are you logged in to STARLIMS?`);
        return;
      }

      // get the form script source reference
      let ref = formScript.sourceReference;

      // get debugger session id
      const sessionId = vscode.debug.activeDebugSession?.id;

      // build uri and open the remote script
      const scriptUri = vscode.Uri.parse(`debug:${cleanUrl(config.url).replace("https://", "").replace("http://", "")}/${scriptName}?session=${sessionId}&ref=${ref}`);
      const scriptDocument = await vscode.workspace.openTextDocument(scriptUri);
      await vscode.window.showTextDocument(scriptDocument);

      // set the editor to read only
      if ((await vscode.commands.getCommands()).includes("workbench.action.files.setActiveEditorReadonlyInSession")) {
        vscode.commands.executeCommand(
          "workbench.action.files.setActiveEditorReadonlyInSession"
        );
      }

      // show the debug console
      vscode.commands.executeCommand("workbench.debug.action.toggleRepl");

      // show the output channel
      outputChannel.show();
    }
  );


  // register the add item command
  vscode.commands.registerCommand("STARLIMS.Add",
    async (item: TreeEnterpriseItem) => {
      // check if a folder has been selected
      if (selectedItem === undefined) {
        vscode.window.showErrorMessage("Please select a folder to add the item to.");
        return;
      }

      // get item type from uri
      let aUri = selectedItem.uri.split("/");

      // last part of the uri should be the item type
      let root = aUri[1];
      let categoryName = aUri.length > 2 ? aUri[2] : "N/A";
      let appName = aUri.length > 3 ? aUri[3] : "N/A";
      let selectedItemType = aUri.length > 0 ? aUri[aUri.length - 1] : "N/A";
      let itemType;
      let itemTypeName;
      let itemLanguage;

      // check if the item type is valid
      if (root === "Applications") {
        // add application category
        if (categoryName === "N/A") {
          itemType = "APPCATEGORY";
          itemTypeName = "Application Category";
          itemLanguage = "N/A";
        }
        // add application to category
        else if (appName === "N/A") {
          itemType = "APP";
          itemTypeName = "Application";
          itemLanguage = "N/A";
        }
        // add item to application
        else {
          // check if the selected item is a valid folder
          if (!["XFDForms", "HTMLForms", "ServerScripts", "ClientScripts", "DataSources"].includes(selectedItemType)) {
            vscode.window.showErrorMessage("Cannot add item here! Please select a valid folder to add the item to.");
            return;
          }

          switch (selectedItemType) {
            case "HTMLForms":
              itemType = "HTMLFORMXML";
              itemTypeName = "HTML Form";
              itemLanguage = "XML";
              break;

            case "XFDForms":
              itemType = "XFDFORMXML";
              itemTypeName = "XFD Form";
              itemLanguage = "XML";
              break;

            case "ServerScripts":
              itemType = "APPSS";
              itemTypeName = "App Server Script";
              itemLanguage = "SSL";
              break;

            case "ClientScripts":
              itemType = "APPCS";
              itemTypeName = "App Client Script";
              itemLanguage = "JS";
              break;

            case "DataSources":
              itemType = "APPDS";
              itemTypeName = "App Data Source";

              // ask for data source language
              itemLanguage = await vscode.window.showQuickPick(
                ["SSL", "SQL"],
                {
                  placeHolder: "Select Data Source language",
                  ignoreFocusOut: true
                }
              );
              break;
          }
        }
      }
      // add global script item
      else {
        if (aUri.length > 3) {
          vscode.window.showErrorMessage("Please select a valid folder to add the item to.");
          return;
        }

        appName = "N/A";

        switch (root) {
          case "ServerScripts":
            if (root === selectedItemType) {
              itemType = "SSCAT";
              itemTypeName = "Server Script Category";
              itemLanguage = "N/A";
            }
            else {
              itemType = "SS";
              itemTypeName = "Server Script";
              itemLanguage = "SSL";
            }
            break;

          case "ClientScripts":
            if (root === selectedItemType) {
              itemType = "CSCAT";
              itemTypeName = "Client Script Category";
              itemLanguage = "N/A";
            }
            else {
              itemType = "CS";
              itemTypeName = "Client Script";
              itemLanguage = "JS";
            }
            break;

          case "DataSources":
            if (root === selectedItemType) {
              itemType = "DSCAT";
              itemTypeName = "Data Source Category";
              itemLanguage = "N/A";
              categoryName = "Data Sources";
            }
            else {
              itemType = "DS";
              itemTypeName = "Data Source";
              categoryName = selectedItemType;

              // ask for data source language
              itemLanguage = await vscode.window.showQuickPick(
                ["SSL", "SQL"],
                {
                  placeHolder: "Select Data Source language",
                  ignoreFocusOut: true
                });
            }
            break;

          default:
            return;
        }
      }

      // abort if no language defined
      if (!itemLanguage) {
        return;
      }

      // ask for item name
      const itemName = await vscode.window.showInputBox({
        prompt: `Enter name for new ${itemTypeName}`,
        ignoreFocusOut: true
      });

      // abort if mandatory arguments are missing
      if (!itemName || !itemType || !itemLanguage || !categoryName || !appName) {
        return;
      }

      // create the item
      var sReturn = await enterpriseService.addItem(itemName, itemType, itemLanguage, categoryName, appName);

      if (sReturn.length > 0) {
        enterpriseProvider.refresh();

        // wait for the tree to refresh
        await new Promise(resolve => setTimeout(resolve, 1000));

        // open newly created item (works only if section is expanded)
        var sUri = `/${root}/${categoryName}/${appName}/${selectedItemType}/${itemName}`;
        var newItem = await enterpriseProvider.getTreeItemByUri(sUri);
        if (newItem !== undefined) {
          vscode.commands.executeCommand("STARLIMS.selectEnterpriseItem", newItem);
        }
      }
    }
  );

  // register the delete item command
  vscode.commands.registerCommand("STARLIMS.Delete",
    async (item: TreeEnterpriseItem) => {
      if (selectedItem === undefined) {
        vscode.window.showErrorMessage("Please select an item to delete.");
        return;
      }
      if (selectedItem.type === EnterpriseItemType.EnterpriseCategory) {
        vscode.window.showErrorMessage("Enterprise Categories cannot be deleted.");
        return;
      }
      if (selectedItem.type === EnterpriseItemType.ServerLog) {
        vscode.window.showErrorMessage("Server Logs cannot be deleted.");
        return;
      }

      // ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete ${selectedItem.label}?`,
        { modal: true },
        "Yes"
      );
      if (confirm !== "Yes") {
        return;
      }

      // delete the item
      var bSuccess = await enterpriseService.deleteItem(selectedItem.uri);
      if (bSuccess) {
        // close open document
        const openDocument = vscode.workspace.textDocuments.find(
          (doc) => selectedItem !== undefined && doc.uri.fsPath.toLowerCase() === selectedItem.filePath?.toLowerCase()
        );
        if (openDocument) {
          vscode.window.showTextDocument(openDocument).then(() => {
            vscode.commands.executeCommand("workbench.action.closeActiveEditor");
          });
        }
        selectedItem = undefined;
        enterpriseProvider.refresh();
      }
    }
  );

  // show connection message
  vscode.commands.registerCommand(
    "STARLIMS.RunDataSource",
    async (item: TreeEnterpriseItem | any) => {
      let remoteUri: string = "";
      // commands can originate from the enterprise tree or from an open editor window
      const isTreeCommand = item instanceof TreeEnterpriseItem;

      if (isTreeCommand) {
        remoteUri = item.uri;
      } else {
        // command originates from a document context menu
        const uri = item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined;
        if (config.has("rootPath")) {
          const remotePath = uri.slice(uri.lastIndexOf(SLVSCODE_FOLDER) + SLVSCODE_FOLDER.length);
          remoteUri = vscode.Uri.parse(`starlims://${remotePath}`).toString();
        }
      }

      outputChannel.appendLine(
        `${new Date().toLocaleString()} Executing remote data source at URI: ${remoteUri}`
      );

      const result = await enterpriseService.runScript(remoteUri);
      if (result) {
        outputChannel.appendLine(JSON.stringify(JSON.parse(result), null, 2));
        outputChannel.show();
        DataViewPanel.render(context.extensionUri, {
          name: remoteUri.toString(),
          data: result,
        });
      }
    }
  );

  // register the RunXFDForm command handler
  vscode.commands.registerCommand(
    "STARLIMS.OpenXFDForm",
    async (item: TreeEnterpriseItem | any) => {
      let remoteUri: string = "";

      // commands can originate from the enterprise tree or from an open editor window
      const isTreeCommand = item instanceof TreeEnterpriseItem;

      if (isTreeCommand) {
        remoteUri = item.uri;
      } else {
        // command originates from a document context menu
        const uri = item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined;
        if (config.has("rootPath")) {
          const remotePath = uri.slice(uri.lastIndexOf(SLVSCODE_FOLDER) + SLVSCODE_FOLDER.length);
          remoteUri = vscode.Uri.parse(`starlims://${remotePath}`).toString();
        }
      }

      outputChannel.appendLine(
        `${new Date().toLocaleString()} Launching remote form at URI: ${remoteUri}`
      );

      const result = await enterpriseService.runXFDForm(remoteUri.toString());
      if (result) {
        outputChannel.appendLine("Launched form successfully. Please wait while the STARLIMS HTML bridge completes the request.");
        outputChannel.show();
      }
    }
  );

  vscode.window.showInformationMessage(
    `Connected to STARLIMS on ${config.url}.`
  );
}

// this method is called when your extension is deactivated
export function deactivate() { }
