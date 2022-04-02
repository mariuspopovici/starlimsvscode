"use strict";
import * as vscode from "vscode";

export class EnterpriseFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  onDidChangeFileDecorations?:
    | vscode.Event<vscode.Uri | vscode.Uri[] | undefined>
    | undefined;
  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    switch (uri.path) {
      case "/checkedOutByOtherUser":
        return {
          color: new vscode.ThemeColor("errorForeground"),
        };
      case "/checkedOutByMe":
        return {
          color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
        };
    }
  }
}
