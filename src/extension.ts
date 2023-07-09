"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { EnterpriseFileDecorationProvider } from "./providers/enterpriseFileDecorationProvider";
import {
  EnterpriseTreeDataProvider,
  TreeEnterpriseItem,
} from "./providers/enterpriseTreeDataProvider";
import { EnterpriseService } from "./services/enterpriseService";
import { EnterpriseTextDocumentContentProvider } from "./providers/enterpriseTextContentProvider";
import path = require("path");
import { DataViewPanel } from "./panels/DataViewPanel";

export async function activate(context: vscode.ExtensionContext) {
  let config = vscode.workspace.getConfiguration("STARLIMS");
  let user: string | undefined = config.get("user");
  let password: string | undefined = config.get("password");
  let url: string | undefined = config.get("url");
  let rootPath: string | undefined = config.get("rootPath");
  let reloadConfig = false;

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

  rootPath = path.join(config.get("rootPath") as string, "SLVSCODE");

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
      if (rootPath && document.uri.fsPath.startsWith(rootPath)) {
        vscode.commands.executeCommand("STARLIMS.Save", document.uri);
      }
    }
  );

  // this command activates the extension
  vscode.commands.registerCommand("STARLIMS.Connect", () => {});

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

      // open leaf nodes only
      if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
        return;
      }

      // check if the item is already open, switch the tab if it is
      const openDocument = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.fsPath === item.filePath
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

        // open the file locally
        if (localFilePath) {
          item.filePath = localFilePath;
          let localUri: vscode.Uri = vscode.Uri.file(localFilePath);
          await vscode.window.showTextDocument(localUri, { preview: false });

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
        vscode.window.showTextDocument(uri);
      }
    }
  );

  // register the RunScript command handler
  vscode.commands.registerCommand(
    "STARLIMS.RunScript",
    async (item: TreeEnterpriseItem | any) => {
      let remoteUri: string = "";
      if (item instanceof TreeEnterpriseItem) {
        remoteUri = item.uri;
      } else {
        const uri = item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined;
        if (config.has("rootPath")) {
          const rootPath: string = path.join(
            config.get("rootPath") as string,
            "SLVSCODE"
          );
          let remotePath = uri.slice(rootPath.length);
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
      // command executed on the file tree
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
            "SLVSCODE"
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
        "SLVSCODE"
      );
      const editor = vscode.window.activeTextEditor;

      if (editor && rootPath) {
        var localUri = editor.document.uri;
        if (localUri) {
          let remotePath = localUri.path.slice(rootPath.length);
          console.log("Opening file: " + remotePath);
          enterpriseService.saveEnterpriseItemCode(
            remotePath,
            editor.document.getText()
          );
        }
      }
    }
  );

  // register the clear log command
  vscode.commands.registerCommand(
    "STARLIMS.ClearLog",
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
  vscode.commands.registerCommand(
    "STARLIMS.Search",
    async (item: TreeEnterpriseItem) => {
      // ask for search text
      const itemName = await vscode.window.showInputBox({
        prompt: "Enter search text",
        ignoreFocusOut: true,
      });
      if (!itemName) {
        return;
      }
      await enterpriseProvider.search(itemName);
    }
  );

  // register the open form command
  vscode.commands.registerCommand(
    "STARLIMS.OpenForm",
    async (item: TreeEnterpriseItem) => {
      if (item.guid === undefined) {
        return;
      }
      // open form in default browser
      const formUrl = `${
        config.url
      }starthtml.lims?FormId=${item.guid.toLowerCase()}&Debug=true`;
      vscode.env.openExternal(vscode.Uri.parse(formUrl));
    }
  );

  vscode.commands.registerCommand(
    "STARLIMS.RunDataSource",
    async (item: TreeEnterpriseItem | any) => {
      let remoteUri: string = "";
      if (item instanceof TreeEnterpriseItem) {
        remoteUri = item.uri;
      } else {
        const uri = item.path
          ? item.path.slice(0, item.path.lastIndexOf("."))
          : undefined;
        if (config.has("rootPath")) {
          const rootPath: string = path.join(
            config.get("rootPath") as string,
            "SLVSCODE"
          );
          let remotePath = uri.slice(rootPath.length);
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

  vscode.window.showInformationMessage(
    `Connected to STARLIMS on ${config.url}.`
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
