"use strict";

/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { Enterprise } from "../services/enterprise";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS designer tree explorer.
 */
export class EnterpriseTreeDataProvider
  implements vscode.TreeDataProvider<TreeEnterpriseItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> =
    new vscode.EventEmitter<TreeEnterpriseItem | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeEnterpriseItem | null> =
    this._onDidChangeTreeData.event;

  private service: Enterprise;

  constructor(enterpriseService: Enterprise) {
    this.service = enterpriseService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public async getChildren(
    element?: TreeEnterpriseItem
  ): Promise<TreeEnterpriseItem[]> {
    var enterpriseTreeItems: TreeEnterpriseItem[] = [];
    var uri: string = element ? element.uri : "";

    let enterpriseItems: TreeEnterpriseItem[] =
      await this.service.getEnterpriseItem(uri);

    const _this = this;
    enterpriseItems.forEach(function (item: any) {
      let enterpriseTreeItem = new TreeEnterpriseItem(
        item.type,
        item.name,
        item.language,
        item.uri,
        item.isFolder
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
      enterpriseTreeItem.command = {
        command: "STARLIMS.selectEnterpriseItem",
        title: "Select Node",
        arguments: [enterpriseTreeItem],
      };
      enterpriseTreeItem.contextValue = item.type;
      enterpriseTreeItem.iconPath = _this.getItemIcon(item);
      enterpriseTreeItem.label = item.checkedOutBy
        ? `${enterpriseTreeItem.label} (Checked out by ${item.checkedOutBy})`
        : enterpriseTreeItem.label;
      enterpriseTreeItem.resourceUri = _this.getItemResource(item);
      enterpriseTreeItems.push(enterpriseTreeItem);
    });

    return enterpriseTreeItems;
  }

  getTreeItem(item: TreeEnterpriseItem): vscode.TreeItem {
    return item;
  }

  private getItemResource(item: any): vscode.Uri | undefined {
    const config = this.service.getConfig();
    let resourceUri = undefined;
    if (item.checkedOutBy && item.checkedOutBy === config.get("user")) {
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByMe");
    } else if (item.checkedOutBy) {
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByOtherUser");
    }

    return resourceUri;
  }

  private getItemIcon(item: any): vscode.ThemeIcon {
    if (item.isFolder) {
      return vscode.ThemeIcon.Folder;
    } else if (item.checkedOutBy) {
      return new vscode.ThemeIcon("lock");
    } else {
      switch (item.type) {
        case "DS":
        case "APPDS":
          return new vscode.ThemeIcon("database");
        case "SS":
        case "APPSS":
        case "APPCS":
        case "HTMLFORMCODE":
        case "XFDFORMCODE":
          return new vscode.ThemeIcon("file-code");
        case "XFDFORMXML":
        case "HTMLFORMXML":
          return new vscode.ThemeIcon("preview");
        case "HTMLFORMGUIDE":
          return new vscode.ThemeIcon("list-flat");
        default:
          return new vscode.ThemeIcon("file-code");
      }
    }
  }
}

export class TreeEnterpriseItem extends vscode.TreeItem {
  type: EnterpriseItemType;
  language: string;
  uri: string;
  constructor(
    type: EnterpriseItemType,
    label: string,
    language: string,
    uri: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.type = type;
    this.language = language;
    this.command = command;
    this.uri = uri;
  }
}

export enum EnterpriseItemType {
  EnterpriseCategory = "CATEGORY",
  AppCategory = "APPCATEGORY",
  Application = "APP",
  XFDFormXML = "XFDFORMXML",
  XFDFormCode = "XFDFORMCODE",
  HTMLFormXML = "HTMLFORMXML",
  HTMLFormCode = "HTMLFORMCODE",
  HTMLFormGuide = "HTMLFORMGUIDE",
  PhoneForm = "PHONEFORM",
  TabletForm = "TABLETFORM",
  AppServerScript = "APPSS",
  AppClientScript = "APPCS",
  AppDataSource = "APPDS",
  ServerScriptCategory = "SSCAT",
  ServerScript = "SS",
  ClientScriptCategory = "CSCAT",
  DataSource = "DS",
  DataSourceCategory = "DSCAT",
}
