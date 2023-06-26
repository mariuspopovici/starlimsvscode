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

  /**
   *  Returns the children of the given element or root if no element is passed.
   * @param element The element to return the children for.
   * @returns The children of the given element or root if no element is passed.
   */
  public async getChildren(element?: TreeEnterpriseItem): Promise<TreeEnterpriseItem[]> {
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
        item.isFolder ? vscode.TreeItemCollapsibleState.Collapsed
                      : vscode.TreeItemCollapsibleState.None
      );
      enterpriseTreeItem.command = {
        command: "STARLIMS.selectEnterpriseItem",
        title: "Select Node",
        arguments: [enterpriseTreeItem],
      };
      enterpriseTreeItem.contextValue = item.type;
      enterpriseTreeItem.iconPath = _this.getItemIcon(item);
      enterpriseTreeItem.label = item.checkedOutBy ? `${enterpriseTreeItem.label} (Checked out by ${item.checkedOutBy})` : enterpriseTreeItem.label;
      enterpriseTreeItem.resourceUri = _this.getItemResource(item);
      enterpriseTreeItems.push(enterpriseTreeItem);
    });

    return enterpriseTreeItems;
  }

  /**
   * Returns the parent of the given element or undefined if no element is passed.
   * @param element The element to return the parent for.
   * @returns The parent of the given element or undefined if no element is passed.
  */   
  getTreeItem(item: TreeEnterpriseItem): vscode.TreeItem {
    return item;
  }

  /**
   *  Returns a URI for the item if it is checked out by the current user.
   * @param item The item to check
   * @returns A URI for the item if it is checked out by the current user, otherwise undefined.
   */
  private getItemResource(item: any): vscode.Uri | undefined {
    const config = this.service.getConfig();
    let resourceUri = undefined;
    if (item.checkedOutBy && item.checkedOutBy === config.get("user")) {
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByMe");
      // change the color of the item
      item.color = new vscode.ThemeColor("gitDecoration.modifiedResourceForeground");
    } else if (item.checkedOutBy) {
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByOtherUser");
      // change the color of the item
      item.color = new vscode.ThemeColor("gitDecoration.untrackedResourceForeground");
    }
    return resourceUri;
  }

  /**
   *  Returns an icon for the item.
   * @param item The item to check
   * @returns An icon for the item.
   */
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
        case "SERVERLOG":
          return new vscode.ThemeIcon("output");
        default:
          return new vscode.ThemeIcon("file-code");
      }
    }
  }
}

/**
 * Represents a tree item in the STARLIMS designer tree explorer.
 */
export class TreeEnterpriseItem extends vscode.TreeItem {
  type: EnterpriseItemType;
  language: string;
  uri: string;
  filePath: string | undefined;
  checkedOutBy: string | undefined;

  constructor(
    type: EnterpriseItemType,
    label: string,
    language: string,
    uri: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    filePath?: string
  ) {
    super(label, collapsibleState);
    this.type = type;
    this.language = language;
    this.command = command;
    this.uri = uri;
    this.filePath = filePath;
  }
}

/**
 * Represents the type of an enterprise item.
 */
export enum EnterpriseItemType {
  EnterpriseCategory = "CATEGORY",
  AppCategory = "APPCATEGORY",
  Application = "APP",
  AppServerScript = "APPSS",
  AppClientScript = "APPCS",
  AppDataSource = "APPDS",
  ClientScriptCategory = "CSCAT",
  DataSource = "DS",
  DataSourceCategory = "DSCAT",
  ServerScriptCategory = "SSCAT",
  ServerScript = "SS",
  XFDFormXML = "XFDFORMXML",
  XFDFormCode = "XFDFORMCODE",
  HTMLFormXML = "HTMLFORMXML",
  HTMLFormCode = "HTMLFORMCODE",
  HTMLFormGuide = "HTMLFORMGUIDE",
  PhoneForm = "PHONEFORM",
  TabletForm = "TABLETFORM",
  ServerLog = "SERVERLOGCAT"
}
