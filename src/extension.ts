"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { EnterpriseFileDecorationProvider } from "./providers/enterpriseFileDecorationProvider";
import { EnterpriseTreeDataProvider, TreeEnterpriseItem, } from "./providers/enterpriseTreeDataProvider";
import { EnterpriseService } from "./services/enterpriseService";
import { EnterpriseTextDocumentContentProvider } from "./providers/enterpriseTextContentProvider";

export async function activate(context: vscode.ExtensionContext) {
  let config = vscode.workspace.getConfiguration("STARLIMS");
  let user: string | undefined = config.get("user");
  let password: string | undefined = config.get("password");
  let url: string | undefined = config.get("url");
  let reloadConfig = false;

  const rootPath = vscode.workspace.workspaceFolders &&  vscode.workspace.workspaceFolders.length > 0? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

  if (!rootPath) {
    vscode.window.showErrorMessage("STARLIMS: Working folder not found, open a workspace folder and try again.");
    return;
  }

  // ensure extension settings are defined and prompt for values if not
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
      vscode.window.showErrorMessage("Please configure STARLIMS URL in extension settings.");
      return;
    }
  }

  if (!user) {
    user = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: "Enter STARLIMS username",
      ignoreFocusOut: true,
    });
    if (user) {
      await config.update("user", user.toUpperCase(), false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage("Please configure STARLIMS user in extension settings.");
    }
  }

  if (!password) {
    password = await vscode.window.showInputBox({
      title: "Configure STARLIMS",
      prompt: `Enter password for STARLIMS user '${user}'`,
      password: true,
      ignoreFocusOut: true,
    });
    if (password) {
      await config.update("password", password, false);
      reloadConfig = true;
    } else {
      vscode.window.showErrorMessage("Please configure STARLIMS password in extension settings.");
    }
  }

  if (reloadConfig) {
    config = vscode.workspace.getConfiguration("STARLIMS");
  }

  const enterpriseService = new EnterpriseService(config);

  // register a text content provider to viewing remote code items. it responds to the starlims:/ URI
  const enterpriseTextContentProvider = new EnterpriseTextDocumentContentProvider(enterpriseService);
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("starlims", enterpriseTextContentProvider));

  // register a custom tree data provider for the STARLIMS enterprise designer explorer
  const enterpriseProvider = new EnterpriseTreeDataProvider(enterpriseService);
  vscode.window.registerTreeDataProvider("STARLIMS", enterpriseProvider);

  // hook into tree events for loading code items
  vscode.commands.registerCommand(
    "STARLIMS.selectEnterpriseItem",
    async (item: TreeEnterpriseItem) => {
      // open only leaf nodes
      if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
        return;
      }

      const fileExtension = item.language !== undefined && item.language !== "" && item.language !== "N/A"? item.language.toLowerCase() : "txt";
      const uri = vscode.Uri.parse(`starlims://${item.uri}.${fileExtension}`);
      const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
      await vscode.window.showTextDocument(doc, { preview: false });
    }
  );

  // register a decoration provider for the STARLIMS enterprise tree
  const fileDecorationProvider = new EnterpriseFileDecorationProvider();
  vscode.window.registerFileDecorationProvider(fileDecorationProvider);

  // this command activates the extension
  vscode.commands.registerCommand("STARLIMS.Connect", () => {});

  // registers the GetLocal version command handler
  vscode.commands.registerCommand(
    "STARLIMS.GetLocal",
    async (item: TreeEnterpriseItem | any) => {
      const localFilePath = await enterpriseService.getLocalCopy(item.uri || 
                                  (item.path? item.path.slice(0, item.path.lastIndexOf(".")) : undefined), rootPath);
      if (localFilePath) {
        let uri: vscode.Uri = vscode.Uri.file(localFilePath);
        vscode.window.showTextDocument(uri);
      }
    }
  );

  const outputChannel = vscode.window.createOutputChannel("STARLIMS");

  // registers the GetLocal version command handler
  vscode.commands.registerCommand("STARLIMS.RunScript",
    async (item: TreeEnterpriseItem | any) => {
      const uri = (item.path? item.path.slice(0, item.path.lastIndexOf(".")) : undefined);
      outputChannel.appendLine(`${new Date().toLocaleString()} Executing remote script at URI: ${uri}`);
      const result = await enterpriseService.runScript(uri);
      if (result) {
        outputChannel.appendLine(result);
        outputChannel.show();
      }
    }
  );

  // registers the remote compare command
  vscode.commands.registerCommand("STARLIMS.Compare",
    async (uri: vscode.Uri) => {
      // is command executed on the file tree
      let localUri = uri;
      if (!localUri) {
        // if not, compare with the open document
        let editor = vscode.window.activeTextEditor;
        if (editor) {
          localUri = editor.document.uri;
        }
      }

      if (localUri) {
        if (vscode.workspace.workspaceFolders !== undefined) {
          const workspaceFolderPath =
            vscode.workspace.workspaceFolders[0].uri.path;
          let remotePath = localUri.path.slice(workspaceFolderPath.length);
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

  // registers the checkout command
  vscode.commands.registerCommand(
    "STARLIMS.Checkout",
    async (item: TreeEnterpriseItem) => {
      await enterpriseService.checkout(item.uri);
    }
  );

  // registers the check in command
  vscode.commands.registerCommand(
    "STARLIMS.Checkin",
    async (item: TreeEnterpriseItem) => {
      let checkinReason: string =
        (await vscode.window.showInputBox({
          prompt: "Enter checkin reason",
          ignoreFocusOut: true,
        })) || "";

      await enterpriseService.checkin(item.uri, checkinReason);
    }
  );

  // registers the refresh command
  vscode.commands.registerCommand(
    "STARLIMS.Refresh",
    async (item: TreeEnterpriseItem) => {
      await enterpriseProvider.refresh();
    }
  );

  // register the save file command
  vscode.commands.registerCommand("STARLIMS.Save",
    async (item: TreeEnterpriseItem) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
      var localUri = editor.document.uri;
      if (localUri) {
        if (vscode.workspace.workspaceFolders !== undefined) {
          const workspaceFolderPath = vscode.workspace.workspaceFolders[0].uri.path;
          let remotePath = localUri.path.slice(workspaceFolderPath.length);
          enterpriseService.saveEnterpriseItemCode(remotePath, editor.document.getText());
        }
      }
    }
  });

  vscode.window.showInformationMessage(`Connected to STARLIMS on ${config.url}.`);
}

// this method is called when your extension is deactivated
export function deactivate() {}
