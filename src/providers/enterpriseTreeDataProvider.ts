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
  private dataMode: string = "LOAD";
  private treeItems: TreeEnterpriseItem[] = [];

  constructor(enterpriseService: Enterprise) {
    this.service = enterpriseService;
  }

  refresh(): void {
    this.dataMode = "LOAD";
    this._onDidChangeTreeData.fire(null);
  }

  clear(): void {
    this.dataMode = "CLEAR";
    this._onDidChangeTreeData.fire(null);
  }

  /** Search for items in the tree.
   * @param searchText The text to search for.
   * @returns The items that match the search text.
   * */
  async search(searchText: string): Promise<void> {
    this.dataMode = "SEARCH";
    this.treeItems = await this.service.searchForItems(searchText);
    this._onDidChangeTreeData.fire(null);
    //this.dataMode = "LOAD";
  }

  /**
   *  Returns the children of the given element.
   * @param element The element to return the children for.
   * @returns The children of the given element.
   */
  public async getChildren(element?: TreeEnterpriseItem): Promise<TreeEnterpriseItem[]> {
    var returnItems: TreeEnterpriseItem[] = [];
    let treeItems: TreeEnterpriseItem[] | undefined;

    // if no element is passed, start from root
    var uri: string = element ? element.uri : "";

    // add mode - get all enterprise items
    if (this.dataMode === "LOAD") {
      treeItems = await this.service.getEnterpriseItems(uri);
    }
    // clear mode - clear the tree
    else if (this.dataMode === "CLEAR") {
      this.treeItems = [];
      return this.treeItems;
    }
    // search mode - search for items
    else if (this.dataMode === "SEARCH") {
      if (this.treeItems.length === 0) {
        throw new Error("No items found!");
      }
      treeItems = this.treeItems;
    }
    if (treeItems === undefined) {
      throw new Error("No items found!");
    }
  
    // loop through the items and create new tree items
    const _this = this;
    treeItems.forEach(function (item: any) {
      // create new tree item
      let newItem = new TreeEnterpriseItem(
        item.type,
        item.name,
        item.language,
        item.uri,
        item.isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        item.command,
        item.filePath,
        item.guid
      );

      // set the command to run when the item is being clicked
      newItem.command = {
        command: "STARLIMS.selectEnterpriseItem",
        title: "Select Node",
        arguments: [newItem]
      };

      newItem.contextValue = item.type;
      newItem.iconPath = _this.getItemIcon(item);
      newItem.label = item.checkedOutBy ? `${newItem.label} (Checked out by ${item.checkedOutBy})` : newItem.label;
      newItem.resourceUri = _this.getItemResource(item);
      returnItems.push(newItem);
    });
    
    // save the tree items for getTreeItemByUri method
    this.treeItems = returnItems;

    return returnItems;
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
   * Get corresponding tree item from open document
   * @param document The document to get the tree item for
   * @returns The tree item for the document
   */
  getTreeItemForDocument(
    document: any
  ): TreeEnterpriseItem {
    const filePath = document.fsPath;
    const fileName = filePath.substring(filePath.lastIndexOf("\\") + 1);
    const enterpriseUri = "starlims:///" + filePath.replace(/\\/g, "/") + "/";
    const guid = document.guid;
    const enterpriseItem = new TreeEnterpriseItem(
      EnterpriseItemType.Application,
      fileName,
      "en",
      enterpriseUri,
      vscode.TreeItemCollapsibleState.None,
      undefined,
      filePath,
      guid
    );
    enterpriseItem.iconPath = new vscode.ThemeIcon("file-code");
    return enterpriseItem;
  }

  /**
   * Search for tree item by its name and return first match
   * @param name The name of the tree item to search for
   * @returns The tree item for the document
   */
  async getTreeItemByName(name: string): Promise<TreeEnterpriseItem | undefined> {
    const enterpriseItems: TreeEnterpriseItem[] = this.treeItems;
    return enterpriseItems.find((item) => item.label === name);
  }

  /**
   * Search for tree item by its uri and return first match
   * @param uri The uri of the tree item to search for
   * @returns The tree item for the document
   */
  async getTreeItemByUri(uri: string): Promise<TreeEnterpriseItem | undefined> {
    const enterpriseItems: TreeEnterpriseItem[] = this.treeItems;
    return enterpriseItems.find((item) => item.uri === uri);
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
    const config = this.service.getConfig();
    if (item.isFolder) {
      return vscode.ThemeIcon.Folder;
    } else if (item.checkedOutBy) {
      return item.checkedOutBy === config.get("user")
        ? new vscode.ThemeIcon("unlock")
        : new vscode.ThemeIcon("lock");
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
  guid: string | undefined;

  constructor(
    type: EnterpriseItemType,
    label: string,
    language: string,
    uri: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    filePath?: string,
    guid?: string
  ) {
    super(label, collapsibleState);
    this.type = type;
    this.language = language;
    this.command = command;
    this.uri = uri;
    this.filePath = filePath;
    this.guid = guid;
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
  ServerLog = "SERVERLOG"
}
