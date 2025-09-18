"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { EnterpriseFileDecorationProvider } from "./providers/enterpriseFileDecorationProvider";
import { EnterpriseItemType, EnterpriseTreeDataProvider, TreeEnterpriseItem } from "./providers/enterpriseTreeDataProvider";
import { EnterpriseService } from "./services/enterpriseService";
import { ExpressServer } from "./services/expressServer";
import { EnterpriseTextDocumentContentProvider } from "./providers/enterpriseTextContentProvider";
import path = require("path");
import { ResourcesDataViewPanel } from "./panels/ResourcesDataViewPanel";
import { GenericDataViewPanel } from "./panels/GenericDataViewPanel";
import { cleanUrl, executeWithProgress } from "./utilities/miscUtils";
import { CheckedOutTreeDataProvider } from "./providers/checkedOutTreeDataProvider";
import { ServerSelectorWebviewProvider, ServerConfig } from "./providers/serverSelectorWebviewProvider";
import * as crypto from 'crypto';

const { version } = require('../package.json');
const SLVSCODE_FOLDER = "SLVSCODE";

export async function activate(context: vscode.ExtensionContext) {
  const secretStorage: vscode.SecretStorage = context.secrets;
  let config = vscode.workspace.getConfiguration("STARLIMS");
  let user: string | undefined = config.get("user");
  let password: string | undefined;
  let url: string | undefined = config.get("url");
  let rootPath: string | undefined = config.get("rootPath");
  let reloadConfig = false;
  let selectedItem: TreeEnterpriseItem | undefined;
  let languages: any[] = [];

  const workspaceKey = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "default";
  const workspaceId = crypto.createHash('sha1').update(workspaceKey).digest('hex');
  const secretKey = `${workspaceId}:userPassword`;

  // ensure STARLIMS URL is defined and prompt for value if not
  if (!url) {
    url = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      placeHolder: "STARLIMS URL (e. g. https://my.starlims.server.com/STARLIMS/)",
      prompt: "Please enter your STARLIMS URL.",
      ignoreFocusOut: true
    });
    if (url) {
      await config.update("url", url, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure the STARLIMS URL in the extension settings."
      );
      return;
    }
  }

  // register the setPassword command
  vscode.commands.registerCommand('STARLIMS.setPassword', async () => {
    const passwordInput: string = await vscode.window.showInputBox({
      title: "Configure STARLIMS (2/4)",
      placeHolder: "STARLIMS Password",
      prompt: `Please enter the password for the STARLIMS User '${user}'.`,
      password: true,
      ignoreFocusOut: true
    }) ?? '';

    secretStorage.store(secretKey, passwordInput);
  });

  // register server configuration commands
  vscode.commands.registerCommand('STARLIMS.configureServer', async () => {
    // This will be handled by the webview provider
    vscode.commands.executeCommand('workbench.view.extension.STARLIMSVSCode');
  });

  vscode.commands.registerCommand('STARLIMS.selectServer', async () => {
    // This will be handled by the webview provider
    vscode.commands.executeCommand('workbench.view.extension.STARLIMSVSCode');
  });

  // ensure Starlims user name is defined and prompt for it if not
  if (!user) {
    user = await vscode.window.showInputBox({
      title: "Configure STARLIMS (3/4)",
      placeHolder: "STARLIMS Username",
      prompt: "Please enter your STARLIMS Username.",
      ignoreFocusOut: true
    });
    if (user) {
      await config.update("user", user.toUpperCase(), false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure the STARLIMS User in the extension settings."
      );
    }
  }

  // get password from secret storage
  password = await secretStorage.get(secretKey);

  // prompt for password if not found in secret storage
  if (!password) {
    password = await vscode.commands.executeCommand('STARLIMS.setPassword');
  }

  // ensure base path is defined and prompt for value if not
  if (!rootPath) {
    let newRootPath = await vscode.window.showInputBox({
      title: "Configure STARLIMS (4/4)",
      placeHolder: "STARLIMS VS Code Root Path (e. g. C:\\STARLIMS\\VSCode)",
      prompt: "Please enter a root path for the STARLIMS VS Code extension.",
      ignoreFocusOut: true
    });
    if (newRootPath) {
      await config.update("rootPath", newRootPath, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage(
        "Please configure the STARLIMS VS Code Root Path in the extension settings."
      );
      return;
    }
  }

  // create root path for the extension
  rootPath = path.join(config.get("rootPath") as string, SLVSCODE_FOLDER);

  // reload configuration if it was updated
  if (reloadConfig) {
    config = vscode.workspace.getConfiguration("STARLIMS");
  }

  // create enterprise service
  const enterpriseService = new EnterpriseService(config, secretStorage);

  const expressServer = new ExpressServer();
  expressServer.start();

  // create output channel for the extension
  const outputChannel = vscode.window.createOutputChannel("STARLIMS", 'log');

  // create output channel for the log
  const logChannel = vscode.window.createOutputChannel("STARLIMS Log", 'log');

  // install ESlint to SLVSCODE folder if not already installed
  // check for .eslintrc.json file
  const eslintConfigFile = path.join(rootPath!, ".eslintrc.json");
  if (!await enterpriseService.fileExists(eslintConfigFile)) {
    executeWithProgress(async () => {
      // copy .eslintrc and package.json to folder
      const eslintConfig = context.asAbsolutePath("src/client/eslint/.eslintrc.json");
      const packageJson = context.asAbsolutePath("src/client/eslint/package.json");
      var fs = require('fs');
      fs.copyFileSync(eslintConfig, eslintConfigFile);
      fs.copyFileSync(packageJson, path.join(rootPath!, "package.json"));

      // install eslint vscode extension
      await vscode.commands.executeCommand("workbench.extensions.installExtension", "dbaeumer.vscode-eslint");

      // run the shell command "npm install"
      const terminal = vscode.window.createTerminal("STARLIMS");
      terminal.show();
      terminal.sendText("cd " + rootPath!);
      terminal.sendText("npm install");
    }, "Installing ESlint to SLVSCODE folder...");
  }

  // verify API version
  enterpriseService.getVersion()
    .then(async (apiVersion) => {
      if (!apiVersion) {
        vscode.window.showWarningMessage('STARLIMS VS Code API is not reachable. Please check connection info or install API package. See extension README for installation instructions.');
        return;
      }

      if (version !== apiVersion) {
        const selection = await vscode.window.showInformationMessage(`A new version (${version}) of the STARLIMS VS Code API is available. Select Upgrade to deploy the new version.`,
          'Upgrade', 'Continue');
        if (selection === 'Upgrade') {
          const sdpPackage = context.asAbsolutePath("dist/SCM_API.sdp");
          executeWithProgress(async () => {
            await enterpriseService.upgradeBackend(sdpPackage);
            const selection = await vscode.window.showInformationMessage(`We recommend that you restart Visual Studio Code.`,
              'Restart', 'Cancel');
            if (selection === "Restart") {
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          }, "Upgrading the extension backend API.");
        }
      }
    });

  // register the refreshLogChannel command
  vscode.commands.registerCommand("STARLIMS.RefreshLogChannel",
    async () => {
      // get current user's log
      const logUri = "/ServerLogs/" + user + ".log";
      var log = await enterpriseService.getEnterpriseItemCode(logUri, undefined);
      if (log) {
        logChannel.clear();
        logChannel.appendLine(log.code);
        logChannel.show(true);
      }
    }
  );

  // register the clearLogChannel command
  vscode.commands.registerCommand("STARLIMS.ClearLogChannel",
    async () => {
      // clear current user's log
      let remoteUri = "/ServerLogs/" + user;
      await enterpriseService.clearLog(remoteUri);

      // refresh log
      var log = await enterpriseService.getEnterpriseItemCode(remoteUri + ".log", undefined);
      if (log) {
        logChannel.clear();
        logChannel.appendLine(log.code);
        logChannel.show(true);
      }
    }
  );

  // load current user's log
  vscode.commands.executeCommand("STARLIMS.RefreshLogChannel");

  // load system languages from server into config
  await enterpriseService.getLanguages();
  for (let lang of enterpriseService.languages) {
    languages.push({ label: lang[0], description: lang[1] });
  }

  // register a custom tree data provider for the STARLIMS enterprise designer explorer
  const enterpriseTreeProvider = new EnterpriseTreeDataProvider(enterpriseService);
  vscode.window.registerTreeDataProvider("STARLIMSMainTree", enterpriseTreeProvider);

  // register a custom tree data provider for the STARLIMS checked out items
  let checkedOutItems = await enterpriseService.getCheckedOutItems(false);
  const checkedOutTreeDataProvider = new CheckedOutTreeDataProvider(checkedOutItems, enterpriseService);
  vscode.window.registerTreeDataProvider("STARLIMSCheckedOutTree", checkedOutTreeDataProvider);

  // Create the server selector webview provider (now that tree providers exist)
  const serverSelectorProvider = new ServerSelectorWebviewProvider(
    context.extensionUri,
    context,
    async (serverConfig: ServerConfig | undefined) => {
      if (serverConfig) {
        try {
          // Update the enterprise service with the new server configuration
          enterpriseService.updateServerConfig(serverConfig, serverConfig.name);
          
          // Refresh the tree data providers to show data from the new server
          enterpriseTreeProvider.refresh();
          
          // Update checked out items for the new server
          vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
          
          // Load languages for the new server
          try {
            await enterpriseService.getLanguages();
            languages = [];
            for (let lang of enterpriseService.languages) {
              languages.push({ label: lang[0], description: lang[1] });
            }
          } catch (error) {
            console.error("Error loading languages for server:", error);
          }
          
          vscode.window.showInformationMessage(`Connected to server: ${serverConfig.name} (${serverConfig.url})`);
        } catch (error) {
          console.error("Error switching to server:", error);
          vscode.window.showErrorMessage(`Failed to connect to server: ${serverConfig.name}`);
        }
      } else {
        vscode.window.showInformationMessage("No server selected");
      }
    }
  );
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ServerSelectorWebviewProvider.viewType,
      serverSelectorProvider
    )
  );

  // Initialize with the selected server if available
  const selectedServerConfig = serverSelectorProvider.getSelectedServer();
  if (selectedServerConfig) {
    // Update service with selected server on startup
    enterpriseService.updateServerConfig(selectedServerConfig, selectedServerConfig.name);
  }

  vscode.commands.registerCommand(
    "STARLIMS.GetCheckedOutItems",
    async () => {
      let checkedOutItems = await enterpriseService.getCheckedOutItems(false);
      vscode.window.registerTreeDataProvider("STARLIMSCheckedOutTree",
        new CheckedOutTreeDataProvider(checkedOutItems, enterpriseService));
    }
  );

  // register a text content provider to viewing remote code items. it responds to the starlims:/ URI
  const enterpriseTextContentProvider =
    new EnterpriseTextDocumentContentProvider(enterpriseService, enterpriseTreeProvider);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "starlims",
      enterpriseTextContentProvider
    )
  );

  // register the GetAllCheckedOutItems command
  vscode.commands.registerCommand(
    "STARLIMS.GetAllCheckedOutItems",
    async () => {
      let checkedOutItems = await enterpriseService.getCheckedOutItems(true);
      vscode.window.registerTreeDataProvider("STARLIMSCheckedOutTree",
        new CheckedOutTreeDataProvider(checkedOutItems, enterpriseService));
    }
  );

  // register the CheckInAllItems command
  vscode.commands.registerCommand(
    "STARLIMS.CheckInAllItems",
    async () => {
      // ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to check in all items?`,
        { modal: true },
        "Yes"
      );
      if (confirm !== "Yes") {
        return;
      }

      // ask for checkin reason
      const checkinReason = await vscode.window.showInputBox({
        title: "Check in all items",
        prompt: "Enter check in reason:",
        ignoreFocusOut: true,
      });

      // refresh tree
      await enterpriseService.checkInAllItems(checkinReason);
      vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
    }
  );

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
    async (item: TreeEnterpriseItem | any) => {
      // if no item is defined, get the item from the active editor
      if (!(item instanceof TreeEnterpriseItem)) {
        if (item.path !== undefined) {
          item = await enterpriseTreeProvider.getTreeItemFromPath(item.path, false) as TreeEnterpriseItem;
        }
      }

      // set the selected item
      selectedItem = item;

      // open leaf nodes only and exclude dummy items ('no items found')
      if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None ||
        item.type === EnterpriseItemType.EnterpriseCategory) {
        return;
      }

      // open the item
      const handler: Function | undefined = getSelectItemHandler(item);
      if (handler !== undefined) {
        executeWithProgress(async () => {
          await handler(item);
        }, "Retrieving selected item...");
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
        rootPath!,
        false,
        item.language
      );
      if (localFilePath) {
        let uri: vscode.Uri = vscode.Uri.file(localFilePath);
        await vscode.window.showTextDocument(uri);
      }
    }
  );

  /**
   * Returns the handler function for the selected enterprise item.
   * @param item the enterprise tree item to handle
   * @returns the handler function for the selected enterprise item
   */
  function getSelectItemHandler(item: TreeEnterpriseItem): Function | undefined {
    const config = new Map([
      [EnterpriseItemType.Table, handleSelectTableItem],
      [EnterpriseItemType.HTMLFormResources, handleSelectResourcesItem],
      [EnterpriseItemType.XFDFormResources, handleSelectResourcesItem]
    ]);

    return config.has(item.type) ? config.get(item.type) : handleSelectCodeItem;
  }

  /**
   * Handles selecting a table item in the enterprise tree.
   * @param item the enterprise tree item to handle
   */
  async function handleSelectTableItem(item: TreeEnterpriseItem) {
    const result = await enterpriseService.getTableDefinition(item.uri);
    const tableName = item.uri.split('/').pop();
    if (result) {
      GenericDataViewPanel.render(context.extensionUri, {
        name: tableName,
        data: result,
        title: `Table Definition: ${tableName}`
      });
    }
  }

  /**
   * Handles selecting a resources item in the enterprise tree.
   * @param item the enterprise tree item to handle
   */
  async function handleSelectResourcesItem(item: TreeEnterpriseItem) {
    // get remote URI
    const remoteUri = enterpriseService.getEnterpriseItemUri(item.uri, rootPath!);

    // get form resources
    let oParams = await enterpriseService.getFormResources(remoteUri, item.language);

    // render the data view panel
    ResourcesDataViewPanel.render(context.extensionUri, oParams, enterpriseService,
      enterpriseTreeProvider);
  }

  /**
   * Handles selecting a code type enterprise item. Such items are: server scripts, data sources, client scripts, 
   * basically anything that needs to be opened in a code editor.
   * @param item the enterprise tree item to handle
   */
  async function handleSelectCodeItem(item: TreeEnterpriseItem) {
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
        await enterpriseService.getLocalCopy(remoteUri, rootPath!, false, item.language);

        // show the document
        await vscode.window.showTextDocument(openDocument);

        // scroll to bottom of document
        enterpriseService.scrollToBottom();
      } else {
        // other file types, just show the document
        await vscode.window.showTextDocument(openDocument);
        highlightGlobalSearchMatches(item, vscode.Uri.file(item.filePath!));
      }
    } else {
      // get local copy of the item
      const localFilePath = await enterpriseService.getLocalCopy(
        item.uri,
        rootPath!,
        false,
        item.language
      );

      // open the item locally
      if (localFilePath) {
        item.filePath = localFilePath;
        let localUri: vscode.Uri = vscode.Uri.file(localFilePath);
        await vscode.window.showTextDocument(localUri, { preview: false });
        highlightGlobalSearchMatches(item, localUri);

        // scroll to bottom of log files
        if (localUri.toString().endsWith(".log")) {
          enterpriseService.scrollToBottom();
        }
      }
    }
  }

  // register the RunScript command handler
  vscode.commands.registerCommand(
    "STARLIMS.RunScript",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // commands can originate from the enterprise tree or from an open editor window
      let remoteUri: string = "";
      if (item instanceof TreeEnterpriseItem) {
        remoteUri = item.uri;
      }
      else {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
      }

      if (item.checkedOutBy === user) {
        // document not saved, save it first
        if (vscode.window.activeTextEditor?.document.isDirty) {
          await vscode.commands.executeCommand("STARLIMS.Save", item);
        }
      }

      outputChannel.appendLine(
        `\n${new Date().toLocaleString()} Executing remote script at URI: ${remoteUri}\n`
      );

      // get user log
      const logUri = "/ServerLogs/" + user + ".log";
      var logBeforeRun = (await enterpriseService.getEnterpriseItemCode(logUri, undefined)).code;

      executeWithProgress(async () => {
        const result = await enterpriseService.runScript(remoteUri.toString());
        if (result) {
          // append current user log to output channel
          let logAfterRun = (await enterpriseService.getEnterpriseItemCode(logUri, undefined)).code;
          let logDiff = logAfterRun.replace(logBeforeRun, "");
          outputChannel.appendLine("### Log output: ###");
          outputChannel.appendLine(logDiff);

          // append script output to output channel
          outputChannel.appendLine("### Script output: ###");
          outputChannel.appendLine(result.data);

          outputChannel.show(true);
        }
      }, "Executing script...");
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
        let remoteUriPath = enterpriseService.getUriFromLocalPath(localUri.path);
        let remoteUri = vscode.Uri.parse(`starlims://${remoteUriPath}`);
        vscode.commands.executeCommand("vscode.diff", remoteUri, localUri);
      } else {
        vscode.window.showErrorMessage(
          "STARLIMS: Working folder not found, open a workspace folder an try again."
        );
      }
    }
  );

  // register the checkout command
  vscode.commands.registerCommand(
    "STARLIMS.CheckOut",
    async (item: TreeEnterpriseItem | any) => {
      if (!(item instanceof TreeEnterpriseItem)) {
        item = await enterpriseTreeProvider.getTreeItemFromPath(item.path, false);
      }

      // choose language for forms only
      let language;
      if (item.type === EnterpriseItemType.XFDFormXML ||
        item.type === EnterpriseItemType.XFDFormResources ||
        item.type === EnterpriseItemType.XFDFormCode ||
        item.type === EnterpriseItemType.HTMLFormXML ||
        item.type === EnterpriseItemType.HTMLFormCode ||
        item.type === EnterpriseItemType.HTMLFormGuide ||
        item.type === EnterpriseItemType.HTMLFormResources) {
        let oReturn = await vscode.window.showQuickPick(
          languages,
          {
            placeHolder: "Select language",
            ignoreFocusOut: true
          }
        );
        language = oReturn.label;
      }
      // check out the item
      let bSuccess = await enterpriseService.checkOutItem(item.uri, language);
      if (bSuccess) {
        enterpriseTreeProvider.setItemCheckedOutStatus(item, true, language);
        vscode.commands.executeCommand("STARLIMS.GetLocal", item);

        // refresh checked out items
        vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
      }
    }
  );

  // register the check in command
  vscode.commands.registerCommand(
    "STARLIMS.Checkin",
    async (item: TreeEnterpriseItem | any) => {
      if (!(item instanceof TreeEnterpriseItem)) {
        item = await enterpriseTreeProvider.getTreeItemFromPath(item.path, false);
      }

      let checkinReason: string =
        (await vscode.window.showInputBox({
          title: "Check in STARLIMS Enterprise Item",
          prompt: "Enter checkin reason",
          ignoreFocusOut: true,
        })) || "Checked in from VSCode";

      let bSuccess = await enterpriseService.checkInItem(item.uri, checkinReason, item.language);
      if (bSuccess) {
        enterpriseTreeProvider.setItemCheckedOutStatus(item, false, item.language);

        // refresh checked out items
        vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
      }
    }
  );

  // register the UndoCheckOut command
  vscode.commands.registerCommand(
    "STARLIMS.UndoCheckOut",
    async (item: TreeEnterpriseItem | any) => {
      if (!(item instanceof TreeEnterpriseItem)) {
        item = await enterpriseTreeProvider.getTreeItemFromPath(item.path, false);
      }

      // remove text in brackets from item name to get the real item name
      let sItemName = item.label.toString();
      if (sItemName.indexOf("[") > 0) {
        sItemName = sItemName.substring(0, sItemName.indexOf("[") - 1);
      } else if (sItemName.indexOf('(Checked out')) {
        sItemName = sItemName.substring(0, sItemName.indexOf("(Checked out") - 1);
      }

      // ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to undo checkout of '${sItemName}' and lose all changes?`,
        { modal: true },
        "Yes"
      );

      if (confirm !== "Yes") {
        return;
      }

      let bSuccess = await enterpriseService.undoCheckOut(item.uri);
      if (bSuccess) {
        enterpriseTreeProvider.setItemCheckedOutStatus(item, false, item.language);

        // refresh checked out items
        vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
      }
    }
  );

  // register the refresh command
  vscode.commands.registerCommand(
    "STARLIMS.Refresh",
    async () => {
      enterpriseTreeProvider.refresh();
    }
  );

  // register the showTreeView command
  vscode.commands.registerCommand(
    "STARLIMS.ShowTreeView",
    async () => {
      enterpriseTreeProvider.refresh();
    }
  );

  // register the save file command
  vscode.commands.registerCommand(
    "STARLIMS.Save",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        let remoteUri = enterpriseService.getUriFromLocalPath(editor.document.uri.path);
        if (await enterpriseService.isCheckedOut(remoteUri)) {
          enterpriseService.saveEnterpriseItemCode(remoteUri, editor.document.getText(), "");
        }
      }
    }
  );

  // register the clear log command
  vscode.commands.registerCommand("STARLIMS.ClearLog",
    async (uri: vscode.Uri) => {

      // ask for confirmation
      let name = path.parse(uri.path).name;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to clear the log for ${name}?`,
        { modal: true },
        "Yes"
      );

      if (confirm === "Yes") {
        let remoteUri = enterpriseService.getUriFromLocalPath(uri.path);
        await enterpriseService.clearLog(remoteUri);
      }
    }
  );

  // register the search command
  vscode.commands.registerCommand("STARLIMS.Search",
    async () => {
      // ask for search text
      const itemName = await vscode.window.showInputBox({
        title: "Search for STARLIMS Enterprise Items",
        prompt: "Please enter the name or parts of the name of the item(s) to search for.",
        placeHolder: "Item name...",
        ignoreFocusOut: true
      });
      if (!itemName) {
        return;
      }
      executeWithProgress(async () => {
        await enterpriseTreeProvider.search(itemName, "", false, false);
      }, "Searching STARLIMS Enterprise...");
    }
  );

  // register the open form command
  vscode.commands.registerCommand("STARLIMS.OpenForm",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // get remote path from local path if opened from editor context menu
      let remoteUri;
      if (item.uri === undefined) {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
      }
      else {
        remoteUri = item.uri;
      }

      // get the form GUID
      const formGuid = await enterpriseService.getGUID(remoteUri);

      // get the language from the checked out item
      const sLangId = item.language;

      // open form in default browser
      const formUrl = `${cleanUrl(config.url)}/starthtml.lims?FormId=${formGuid}&LangId=${sLangId}&Debug=true`;
      vscode.env.openExternal(vscode.Uri.parse(formUrl));
    }
  );

  // register the edit HTML form command
  vscode.commands.registerCommand("STARLIMS.DesignHTMLForm",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // get remote path from local path if opened from editor context menu
      let remoteUri;
      if (item.uri === undefined) {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
      }
      else {
        remoteUri = item.uri;
      }

      // get the form GUID
      const formGuid = await enterpriseService.getGUID(remoteUri);

      // open form in default browser
      const formUrl = `${cleanUrl(config.url)}/starthtml.lims?FormId=1D09BB79-2D28-4594-8B03-26306F5C8AEC&LangId=ENG&Debug=true&FormArgs=%22${formGuid}%22`;
      vscode.env.openExternal(vscode.Uri.parse(formUrl));
    }
  );

  // register the start debugging command
  vscode.commands.registerCommand("STARLIMS.DebugForm",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // get remote path from local path if opened from editor context menu
      let remoteUri;
      if (item.uri === undefined) {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
      }
      else {
        remoteUri = item.uri;
      }

      // get the form GUID
      const formGuid = await enterpriseService.getGUID(remoteUri);

      // read STARLIMS.browser configuration value (edge or chrome)
      const browserType = config.get("browser") as string;

      // check if vscode debugger is already running
      const debuggerRunning = vscode.debug.activeDebugSession !== undefined;

      // get the language from the checked out item
      const sLangId = item.language;

      var debugConfig;
      if (!debuggerRunning) {
        // launch browser in debug mode
        debugConfig = {
          type: browserType,
          name: "Launch STARLIMS Debugging",
          request: "launch",
          url: `${cleanUrl(config.url)}/starthtml.lims?FormId=${formGuid}&LangId=${sLangId}&Debug=true`,
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
        const debuggerAttached = vscode.debug.activeDebugSession?.name.includes(`FormId=${formGuid}`);

        // if not, attach new debug session to the browser
        if (!debuggerAttached) {
          debugConfig = {
            type: browserType,
            name: "Attach to STARLIMS Debugging",
            request: "attach",
            url: `${cleanUrl(config.url)}/starthtml.lims?FormId=${formGuid}&LangId=${sLangId}&Debug=true`,
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
      const appName = remoteUri.split("/")[3];
      const fileName = remoteUri.split("/").pop() + ".js";
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
      //outputChannel.show();
    }
  );

  // register the add item command
  vscode.commands.registerCommand("STARLIMS.Add",
    async () => {
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
        title: "Add STARLIMS Enterprise Item",
        placeHolder: `Name for new ${itemTypeName}...`,
        prompt: `Please enter a name for the new ${itemTypeName}.`,
        ignoreFocusOut: true
      });

      // abort if mandatory arguments are missing
      if (!itemName || !itemType || !itemLanguage || !categoryName || !appName) {
        return;
      }

      // create the item
      var sReturn = await enterpriseService.addItem(itemName, itemType, itemLanguage, categoryName, appName);
      if (sReturn.length === 0) {
        return;
      }

      // ask for language for forms only
      let language;
      if (itemType === "XFDFORMXML" || itemType === "HTMLFORMXML") {
        let oReturn = await vscode.window.showQuickPick(
          languages,
          {
            placeHolder: "Select language",
            ignoreFocusOut: true
          }
        );
        language = oReturn.label;

        // add item language to the selected item type
        selectedItemType = `${selectedItemType}/${itemLanguage}`;
      }

      // check out the item unless it's an enterprise item category
      
      let sUri = appName !== 'N/A' ? `/${root}/${categoryName}/${appName}/${selectedItemType}/${itemName}` :
        `/${root}/${categoryName}/${itemName}`;

      if (itemType.indexOf("CAT") === -1) {
        let bSuccess = await enterpriseService.checkOutItem(sUri, language);
      }

      await enterpriseTreeProvider.refresh();            

      // wait for the tree to refresh
      await new Promise(resolve => setTimeout(resolve, 3000));

      // open newly created item (works only if section is expanded)
      let newItem = await enterpriseTreeProvider.getTreeItemByUri(sUri);
      if (newItem !== undefined) {
        vscode.commands.executeCommand("STARLIMS.selectEnterpriseItem", newItem);
      }

      // refresh checkout tree
      vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
    }
  );

  // register the delete item command
  vscode.commands.registerCommand("STARLIMS.Delete",
    async () => {
      if (selectedItem === undefined || selectedItem.label === undefined) {
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

      // remove text in brackets from item name to get the real item name
      let sItemName = selectedItem.label.toString();
      if (sItemName.indexOf("[") > 0) {
        sItemName = sItemName.substring(0, sItemName.indexOf("[") - 1);
      } else if (sItemName.indexOf('(Checked out') > 0) {
        sItemName = sItemName.substring(0, sItemName.indexOf("(Checked out") - 1);
      }

      // ask for confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete '${sItemName}'?`,
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

        // refresh trees
        enterpriseTreeProvider.refresh();
        vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");
      }
    }
  );

  // register the run data source command
  vscode.commands.registerCommand(
    "STARLIMS.RunDataSource",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // commands can originate from the enterprise tree or from an open editor window
      let remoteUri: string = "";
      if (item instanceof TreeEnterpriseItem) {
        remoteUri = item.uri;
      } else {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
      }

      outputChannel.appendLine(
        `${new Date().toLocaleString()} Executing remote data source at URI: ${remoteUri}`
      );

      executeWithProgress(async () => {
        const result = await enterpriseService.runScript(remoteUri);
        if (result?.success) {
          const dataSourceName = remoteUri.split('/').pop();
          GenericDataViewPanel.render(context.extensionUri, {
            name: dataSourceName,
            data: result.data,
            title: `Data Source Output: ${dataSourceName}`
          });
        }
        outputChannel.appendLine(result.data);
        outputChannel.show();
      }, "Executing data source...");
    }
  );

  // register the RunXFDForm command handler
  vscode.commands.registerCommand(
    "STARLIMS.OpenXFDForm",
    async (item: TreeEnterpriseItem | any) => {
      // get item from editor if no item is defined (shortcut key pressed)
      if (item === undefined) {
        let editor = vscode.window.activeTextEditor;
        item = editor?.document.uri;
      }

      // commands can originate from the enterprise tree or from an open editor window
      let remoteUri: string = "";
      if (item instanceof TreeEnterpriseItem) {
        remoteUri = item.uri;
      } else {
        remoteUri = enterpriseService.getUriFromLocalPath(item.path);
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

  // insert text into the active editor
  const editorInsert = (text: string) => {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
      activeTextEditor.edit(editBuilder => {
        editBuilder.insert(activeTextEditor.selection.active, text);
      });
    }
  };

  // register the generate table select command
  vscode.commands.registerCommand(
    "STARLIMS.GenerateTableSelect",
    async (item: TreeEnterpriseItem | any) => {
      const result = await enterpriseService.getTableCommand(item.uri, "SELECT");
      if (result) {
        editorInsert(result);
      }
    }
  );

  // register the generate table delete command
  vscode.commands.registerCommand(
    "STARLIMS.GenerateTableDelete",
    async (item: TreeEnterpriseItem | any) => {
      const result = await enterpriseService.getTableCommand(item.uri, "DELETE");
      if (result) {
        editorInsert(result);
      }
    }
  );

  // register the generate table insert command
  vscode.commands.registerCommand(
    "STARLIMS.GenerateTableInsert",
    async (item: TreeEnterpriseItem | any) => {
      const result = await enterpriseService.getTableCommand(item.uri, "INSERT");
      if (result) {
        editorInsert(result);
      }
    }
  );

  // register the generate table update command
  vscode.commands.registerCommand(
    "STARLIMS.GenerateTableUpdate",
    async (item: TreeEnterpriseItem | any) => {
      const result = await enterpriseService.getTableCommand(item.uri, "UPDATE");
      if (result) {
        editorInsert(result);
      }
    }
  );

  // register the send name to editor command
  vscode.commands.registerCommand(
    "STARLIMS.SendNameToEditor",
    async (item: TreeEnterpriseItem | any) => {
      editorInsert(item.label);
    }
  );

  // register the GoToServerScript command
  vscode.commands.registerCommand(
    "STARLIMS.GoToServerScript",
    async () => {
      var editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      // get the script name from editor cursor position
      const position = editor.selection.active;
      let scriptName = editor.document.getText(editor.document.getWordRangeAtPosition(position, /[\w\.]+/));
      let aScriptNameComponents = scriptName.split(".");

      // remove first and main_ component (script type in log file)
      if (aScriptNameComponents[0] === "ServerScript") {
        aScriptNameComponents.shift();
        if (aScriptNameComponents[2] === "main_") {
          aScriptNameComponents.pop();
          scriptName = aScriptNameComponents.join(".");
        }
      }

      let found = false;

      if (aScriptNameComponents.length === 0) {
        found = false;
      }
      else if (aScriptNameComponents.length === 1) {
        // this is probably a procedure in the current script
        found = findProcedureInEditor(scriptName, editor);
        if (!found) {
          // it could be in an :INCLUDEd library
          const libraryNames = findIncludedScripts(editor);
          for (const library of libraryNames) {
            found = await findScriptOnServer(library, scriptName);
            if (found) { break; }
          }
        }
      } else {
        // this is a server script or external script procedure, search on server to find the main script
        const procedureName = aScriptNameComponents.length > 2 ? aScriptNameComponents[2] : undefined;
        found = await findScriptOnServer(scriptName, procedureName);
      }

      if (!found) {
        vscode.window.showErrorMessage("Couldn't find selected item.");
      }

      async function findScriptOnServer(scriptName: string, procedureName: string | undefined) {
        let itemFound = await enterpriseTreeProvider.search(scriptName, "SS", true, false, true);
        if (itemFound) {
          await vscode.commands.executeCommand("STARLIMS.GetLocal", itemFound);
          // get new editor
          editor = vscode.window.activeTextEditor;
          if (editor && procedureName) {
            // find procedure in the newly opened editor
            return findProcedureInEditor(procedureName, editor);
          }
          return true;
        } {
          return false;
        }
      }

      function findProcedureInEditor(procedureName: string, editor: vscode.TextEditor): boolean {
        const procName = `:PROCEDURE ${[procedureName]};`;
        // search the opened document for the procedure name and set cursor to the line of occurrence
        const procPosition = editor.document.getText().indexOf(procName);
        if (procPosition > 0) {
          const position = editor.document.positionAt(procPosition);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
          return true;
        } else {
          return false;
        }
      }

      function findIncludedScripts(editor: vscode.TextEditor) {
        // find all included scripts in the current document
        let regex = /:INCLUDE\s+"([^"]*)";/g;
        let matches;
        let libraryNames = [];
        while ((matches = regex.exec(editor.document.getText())) !== null) {
          libraryNames.push(matches[1]); // Add the captured group to the array
        }

        return libraryNames;
      }
    }
  );

  // register the GoToDataSource command
  vscode.commands.registerCommand(
    "STARLIMS.GoToDataSource",
    async () => {
      var editor = vscode.window.activeTextEditor;
      if (editor) {
        // get the script name from editor cursor position
        const position = editor.selection.active;
        let scriptName = editor.document.getText(editor.document.getWordRangeAtPosition(position, /[\w\.]+/));
        let aScriptNameComponents = scriptName.split(".");

        // remove first and main_ component (script type in log file)
        if (aScriptNameComponents[0] === "DataSource") {
          aScriptNameComponents.shift();
          if (aScriptNameComponents[2] === "main_") {
            aScriptNameComponents.pop();
            scriptName = aScriptNameComponents.join(".");
          }
        }

        // use search to find the script
        const itemFound = await enterpriseTreeProvider.search(scriptName, "DS", true, false, true);

        // open the first item found
        if (itemFound !== undefined) {
          vscode.commands.executeCommand("STARLIMS.GetLocal", itemFound);
        }
      }
    }
  );

  // register the GoToClientScript command
  vscode.commands.registerCommand(
    "STARLIMS.GoToClientScript",
    async () => {
      var editor = vscode.window.activeTextEditor;
      if (editor) {
        // get the script name from editor cursor position
        const position = editor.selection.active;
        const scriptName = editor.document.getText(editor.document.getWordRangeAtPosition(position, /[\w\.]+/));

        // use search to find the script
        const itemFound = await enterpriseTreeProvider.search(scriptName, "CS", true, false, true);

        // open the first item found
        if (itemFound !== undefined) {
          vscode.commands.executeCommand("STARLIMS.GetLocal", itemFound);
        }
      }
    }
  );

  // register the GoToForm command
  vscode.commands.registerCommand(
    "STARLIMS.GoToForm",
    async () => {
      var editor = vscode.window.activeTextEditor;
      if (editor) {
        // get the form name from editor cursor position
        const position = editor.selection.active;
        const formName = editor.document.getText(editor.document.getWordRangeAtPosition(position, /[\w\.]+/));

        // use search to find the script
        const itemFound = await enterpriseTreeProvider.search(formName, "FORMCODEBEHIND", true, false, true);

        // open the first item found
        if (itemFound !== undefined) {
          vscode.commands.executeCommand("STARLIMS.GetLocal", itemFound);
        }
      }
    }
  );

  // register the GoToItem command
  vscode.commands.registerCommand(
    "STARLIMS.GoToItem",
    async () => {
      const autoDetectConfig = [
        {
          command: "STARLIMS.GoToServerScript",
          keywords: ["lims.CallServer", "ExecFunction", "CreateUDObject", "SubmitToBatch", "DoProc", "ServerScript"]
        },
        {
          command: "STARLIMS.GoToDataSource",
          keywords: ["lims.GetData", "DataSource"]
        },
        {
          command: "STARLIMS.GoToForm",
          keywords: ["Form"]
        },
        {
          command: "STARLIMS.GoToClientScript",
          keywords: ["#include"]
        }
      ];

      var editor = vscode.window.activeTextEditor;
      if (editor) {
        // get the current line
        const line = editor.document.lineAt(editor.selection.active.line).text;
        const match = autoDetectConfig.find(config => new RegExp(config.keywords.join("|"), "i").test(line));
        if (match) {
          vscode.commands.executeCommand(match.command);
        } else {
          vscode.window.showErrorMessage("Could not find a STARLIMS item to navigate to.");
        }
      }
    }
  );

  // register the GlobalCodeSearch command
  vscode.commands.registerCommand(
    "STARLIMS.GlobalCodeSearch",
    async () => {
      // get the search term from the user
      const searchTerm = await vscode.window.showInputBox({
        title: "Global Code Search",
        prompt: "Enter a search term to find in all code documents.",
        placeHolder: "Search term...",
        ignoreFocusOut: true
      });
      // let the user select the item types to search
      const itemTypes = await vscode.window.showQuickPick(
        [
          { label: "All", description: "All Items", itemType: "ALL" },
          { label: "Forms", description: "HTML and XFD Forms (Code Behind)", itemType: "FORMCODEBEHIND" },
          { label: "Application Client Scripts", description: "Application Client Scripts", itemType: "APPCS" },
          { label: "Application Server Scripts", description: "Application Server Scripts", itemType: "APPSS" },
          { label: "Application Data Sources", description: "Application Data Sources", itemType: "APPDS" },
          { label: "Server Scripts", description: "Global Server Scripts", itemType: "GLBSS" },
          { label: "Client Scripts", description: "Global Client Scripts", itemType: "GLBCS" },
          { label: "Data Sources", description: "Global Data Sources", itemType: "GLBDS" }
        ],
        {
          title: "Global Code Search",
          placeHolder: "Select the item types to include in the search...",
          canPickMany: true,
          ignoreFocusOut: true
        }
      );
      if (itemTypes === undefined) {
        return;
      }

      // convert item types to string
      const itemTypesString = itemTypes.map(itemType => itemType.itemType).join(",");

      // remove all breakpoints
      vscode.debug.removeBreakpoints(vscode.debug.breakpoints);

      if (searchTerm) {
        // display a progress message
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Searching STARLIMS, please wait...",
            cancellable: false
          },
          async (progress, token) => {
            // find all items matching the search term
            await enterpriseTreeProvider.search(searchTerm, itemTypesString, false, true);
          }
        );
      }
    }
  );

  // register the Rename command
  vscode.commands.registerCommand(
    "STARLIMS.Rename",
    async () => {
      if (selectedItem === undefined) {
        vscode.window.showErrorMessage("Please select an item to rename.");
        return;
      }

      if (selectedItem.type === EnterpriseItemType.ServerLog) {
        vscode.window.showErrorMessage("Server Logs cannot be renamed.");
        return;
      }

      let aUri = selectedItem.uri.split("/");
      const oldName = aUri.pop() || "";

      // ask for confirmation
      const newName: string = await vscode.window.showInputBox({
        title: "Rename Enterprise Item",
        placeHolder: "New item name...",
        prompt: "Enter a new item name",
        ignoreFocusOut: true,
        value: oldName
      }) || "";

      // rename the item
      if (newName) {
        const bSuccess = await enterpriseService.renameItem(selectedItem.uri, newName);
        if (bSuccess) {
          // refresh trees
          enterpriseTreeProvider.refresh();
          vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");

          // close and delete (local copies) open documents with the old name
          const filteredTextDocuments = vscode.workspace.textDocuments.filter(td => td.fileName.indexOf(oldName) > 0);
          for (const td of filteredTextDocuments) {
            await vscode.window.showTextDocument(td, { preview: true, preserveFocus: false });
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            try {
              await vscode.workspace.fs.delete(td.uri);
            }
            catch (e) {
              // ignore
            }
          }
        }
      }
    }
  );

  // move item
  vscode.commands.registerCommand(
    "STARLIMS.Move",
    async () => {
      if (selectedItem === undefined) {
        vscode.window.showErrorMessage("Please select an item to move.");
        return;
      }

      if (selectedItem.type === EnterpriseItemType.ServerLog) {
        vscode.window.showErrorMessage("Server Logs cannot be renamed.");
        return;
      }

      let aUri = selectedItem.uri.split("/");
      const itemName = aUri.pop() || "";

      const refreshTreeAndCloseEditors = async (itemName: string) => {
        // refresh trees
        enterpriseTreeProvider.refresh();
        vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");

        // close and delete (local copies) open documents with the old name
        const filteredTextDocuments = vscode.workspace.textDocuments.filter(td => td.fileName.indexOf(itemName) > 0);
        for (const td of filteredTextDocuments) {
          await vscode.window.showTextDocument(td, { preview: true, preserveFocus: false });
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          try {
            await vscode.workspace.fs.delete(td.uri);
          }
          catch (e) {
            // ignore
          }
        }
      };

      switch (selectedItem.type) {
        case EnterpriseItemType.AppClientScript:
        case EnterpriseItemType.AppDataSource:
        case EnterpriseItemType.AppServerScript:
        case EnterpriseItemType.HTMLFormCode:
        case EnterpriseItemType.HTMLFormGuide:
        case EnterpriseItemType.HTMLFormResources:
        case EnterpriseItemType.HTMLFormXML:
        case EnterpriseItemType.XFDFormCode:
        case EnterpriseItemType.XFDFormResources:
        case EnterpriseItemType.XFDFormXML:
          const appItems = await enterpriseService.getEnterpriseItems("/Applications/*");
          const applications = appItems.map(({ name }: any) => ({ label: name, description: name }));
          const application: any = await vscode.window.showQuickPick(
            applications,
            {
              title: `Moving '${itemName}' - Select Application`,
              placeHolder: "Select the application where to move the selected item...",
              canPickMany: false,
              ignoreFocusOut: true
            }
          );

          if (application) {
            const bSuccess = await enterpriseService.moveItem(selectedItem.uri, application.label);
            if (bSuccess) {
              await refreshTreeAndCloseEditors(itemName);
            }
          }

          break;
        case EnterpriseItemType.ServerScript:
          const ssCategoryItems = await enterpriseService.getEnterpriseItems("/ServerScripts");
          const ssCategories = ssCategoryItems.map(({ name }: any) => ({ label: name, description: name }));
          const ssCategory: any = await vscode.window.showQuickPick(
            ssCategories,
            {
              title: `Moving '${itemName}' - Select Server Script Category`,
              placeHolder: "Select the server scripts category where to move the selected item...",
              canPickMany: false,
              ignoreFocusOut: true
            }
          );

          if (ssCategory) {
            const bSuccess = await enterpriseService.moveItem(selectedItem.uri, ssCategory.label);
            if (bSuccess) {
              await refreshTreeAndCloseEditors(itemName);
            }
          }

          break;
        case EnterpriseItemType.DataSource:
          const dsCategoryItems = await enterpriseService.getEnterpriseItems("/DataSources");
          const dsCategories = dsCategoryItems.map(({ name }: any) => ({ label: name, description: name }));
          const dsCategory: any = await vscode.window.showQuickPick(
            dsCategories,
            {
              title: `Moving '${itemName}' - Select Data Source Category`,
              placeHolder: "Select the data sources category where to move the selected item...",
              canPickMany: false,
              ignoreFocusOut: true
            }
          );

          if (dsCategory) {
            const bSuccess = await enterpriseService.moveItem(selectedItem.uri, dsCategory.label);
            if (bSuccess) {
              await refreshTreeAndCloseEditors(itemName);
            }
          }

          break;
        case EnterpriseItemType.ClientScript:
          const csCategoryItems = await enterpriseService.getEnterpriseItems("/ClientScripts");
          const csCategories = csCategoryItems.map(({ name }: any) => ({ label: name, description: name }));
          const csCategory: any = await vscode.window.showQuickPick(
            csCategories,
            {
              title: `Moving '${itemName}' - Select Client Script Category`,
              placeHolder: "Select the client scripts category where to move the selected item...",
              canPickMany: false,
              ignoreFocusOut: true
            }
          );

          if (csCategory) {
            const bSuccess = await enterpriseService.moveItem(selectedItem.uri, csCategory.label);
            if (bSuccess) {
              await refreshTreeAndCloseEditors(itemName);
            }
          }

          break;
        default:
          vscode.window.showErrorMessage(`Items of type '${selectedItem.type}' cannot be moved.`);
          return;
      }
    }
  );

  // register the OpenCodeBehind command
  vscode.commands.registerCommand("STARLIMS.OpenCodeBehind", async (formId: string | any, functionName: string | any) => {
    // get tree item from formId
    var item = await enterpriseService.getItemByGUID(formId, EnterpriseItemType.HTMLFormCode);
    if (item === null) {
      vscode.window.showErrorMessage("Could not find the selected item.");
      return;
    }

    if (item !== undefined) {
      vscode.commands.executeCommand("STARLIMS.GetLocal", item);

      // go to the function name
      if (functionName !== undefined) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const text = editor.document.getText();
          const regex = new RegExp(`async function ${functionName}\\(`, "mig");
          const match = regex.exec(text);
          if (match) {
            const position = editor.document.positionAt(match.index);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          }
        }
      }
    }
  });

  // show the connection message
  vscode.window.showInformationMessage(
    `Connected to STARLIMS on ${config.url}.`
  );
}

async function highlightGlobalSearchMatches(item: TreeEnterpriseItem, localUri: vscode.Uri) {
  // mark all occurrences of the global search term 
  if (item.globalSearchTerm) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const regex = new RegExp(item.globalSearchTerm, "mig");
      const matches = text.matchAll(regex);
      if (matches) {
        // get positions of matches
        var positions = new Array<vscode.Range>();
        for (const match of matches) {
          if (match.index === undefined) {
            continue; // skip invalid matches
          }
          var start = editor.document.positionAt(match.index);
          var end = editor.document.positionAt(match.index + match[0].length);
          positions.push(new vscode.Range(start, end));
        }

        // highlight matches
        var decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
          isWholeLine: false
        });
        const decorations = positions.map((range) => ({ range, hoverMessage: 'Matched text' }));
        editor.setDecorations(decorationType, decorations);

        // scroll to first match
        editor.revealRange(positions[0], vscode.TextEditorRevealType.InCenter);

        // set breakpoints on matches
        var breakpoints = new Array<vscode.SourceBreakpoint>();
        positions.forEach((position) => {
          var location = new vscode.Location(localUri, position);
          breakpoints.push(new vscode.SourceBreakpoint(location));
        });
        vscode.debug.addBreakpoints(breakpoints);
      }
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() { }

