"use strict";
import * as vscode from "vscode";
import { IEnterpriseService } from "../services/iEnterpriseService";
import { EnterpriseTreeDataProvider } from "../providers/enterpriseTreeDataProvider";
export class EnterpriseTextDocumentContentProvider
  implements vscode.TextDocumentContentProvider {
  // emitter and its event
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;
  service: IEnterpriseService;
  enterpriseTreeProvider: EnterpriseTreeDataProvider;
  promptOpen: boolean = false;

  constructor(enterpriseService: IEnterpriseService, treeProvider: EnterpriseTreeDataProvider) {
    this.service = enterpriseService;
    this.enterpriseTreeProvider = treeProvider;

    // Register the onDidChangeTextDocument event listener
    vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this);
  }

  /**
   * Retrieve the text document content for the given uri.
   * @param uri The uri of the text document.
   * @returns The text document content.
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const result: any = await this.service.getEnterpriseItemCode(uri.path);
    return result.code || "";
  }

  async onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    const document = event.document;

    // Check if the document has already been checked out in this session
    const uri = await this.service.getUriFromLocalPath(document.fileName);
    if (await this.service.isCheckedOut(uri) === true) {
      return;
    }

    // get the checked out status from the server
    let item = await this.enterpriseTreeProvider.getTreeItemFromPath(document.fileName, true);
    if (item === undefined) {
      return;
    }

    // Check if the document is checked out (is null or empty string)
    if (item.checkedOutBy === '') {
      // Revert the changes made by the user
      await vscode.commands.executeCommand('workbench.action.files.revert', document.uri);

      if (!this.promptOpen) {
        // Prompt the user to check out the item
        this.promptOpen = true;
        const result = await vscode.window.showInformationMessage(
          'This item cannot be edited because it is not checked out. Would you like to check it out?',
          'Yes',
          'No'
        );

        this.promptOpen = false;

        if (result === 'Yes') {
          vscode.commands.executeCommand('STARLIMS.CheckOut', item);
        }
      }
    }
    else {
      this.service.setCheckedOut(uri);
    }
  }
}
