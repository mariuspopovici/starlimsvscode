"use strict";

import * as vscode from "vscode";
import { Enterprise } from "../services/enterprise";

export class EnterpriseTextDocumentContentProvider
  implements vscode.TextDocumentContentProvider
{
  // emitter and its event
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;
  service: Enterprise;

  constructor(enterpriseService: Enterprise) {
    this.service = enterpriseService;
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
}
