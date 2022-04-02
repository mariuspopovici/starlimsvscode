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

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const result: any = await this.service.getEntepriseItemCode(uri.path);

    return result.Code || "";
  }
}
