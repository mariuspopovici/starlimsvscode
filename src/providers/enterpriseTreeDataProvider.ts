"use strict";

/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { Enterprise } from "../services/enterprise";
import path from "path";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS designer tree explorer.
 */
export class EnterpriseTreeDataProvider implements vscode.TreeDataProvider<TreeEnterpriseItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> =
    new vscode.EventEmitter<TreeEnterpriseItem | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeEnterpriseItem | null> = this._onDidChangeTreeData.event;

  private service: Enterprise;
  private dataMode: string = "LOAD";
  private treeItems: TreeEnterpriseItem[] = [];
  static service: any;

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

  /** Search for items on the server.
   * @param itemName The text to search for.
   * @param itemType The type of items to search for.
   * @returns First item found.
   * */
  async search(itemName: string, itemType: string, bSilent: boolean): Promise<TreeEnterpriseItem | undefined> {
    if (itemName === "") {
      return;
    }
    var resultItems = await this.service.searchForItems(itemName, itemType);
    if (resultItems === undefined || resultItems.length === 0) {
      vscode.window.showErrorMessage("No items found!");
      return;
    }
    else {
      if (bSilent === false) {
        this.dataMode = "SEARCH";
        this.treeItems = resultItems;
        this._onDidChangeTreeData.fire(null);

        // wait for the tree to be refreshed
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return resultItems[0];
    }
  }

  /**
   * Get the first item in the tree.
   * @returns The first item in the tree.
   */
  async getFirstItem(): Promise<TreeEnterpriseItem | undefined> {
    const treeItems = await this.getChildren();
    return treeItems[0];
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
      newItem.checkedOutBy = item.checkedOutBy;
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
  async getTreeItemForDocument(document: any): Promise<TreeEnterpriseItem | undefined> {
    const localUri = document.uri;
    const config = this.service.getConfig();
    const rootPath: string = path.join(config.get("rootPath") as string, "SLVSCODE");
    let remotePath = localUri.path.slice(rootPath.length + 1);
    remotePath = remotePath.slice(0, remotePath.lastIndexOf("."));
    remotePath = remotePath.startsWith("/") ? remotePath : `/${remotePath}`;

    const [item] = await this.service.getEnterpriseItems(remotePath);

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

    return newItem;
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

  private getCustomIcon(icon: string): any {
    return {
      light: path.join(__filename, "..", "..", "resources", "light", icon),
      dark: path.join(__filename, "..", "..", "resources", "dark", icon)
    };
  }

  /**
   *  Returns an icon for the item.
   * @param item The item to check
   * @returns An icon for the item.
   */
  private getItemIcon(item: any): any {
    const config = this.service.getConfig();
    if (item.isFolder) {
      switch (item.type) {
        case EnterpriseItemType.EnterpriseCategory:
          switch (item.name) {
            case "Applications":
              return this.getCustomIcon("apps.svg");
            case "Tables":
              return this.getCustomIcon("db.svg");
            case "Server Scripts":
              return this.getCustomIcon("ssl_docs.svg");
            case "Client Scripts":
              return this.getCustomIcon("js_docs.svg");
            case "Data Sources":
              return this.getCustomIcon("sql_docs.svg");
            case "Server Logs":
              return new vscode.ThemeIcon("output");
          }
        case EnterpriseItemType.Application:
          return this.getCustomIcon("app.svg");
        case EnterpriseItemType.AppCategory:
          return this.getCustomIcon("apps.svg");
        case EnterpriseItemType.AppClientScriptCategory:
          return this.getCustomIcon("js_docs.svg");
        case EnterpriseItemType.AppServerScriptCategory:
          return this.getCustomIcon("ssl_docs.svg");
        case EnterpriseItemType.AppDataSourceCategory:
          return this.getCustomIcon("sql_docs.svg");
        case EnterpriseItemType.XFDFormCategory:
          return this.getCustomIcon("xfd_form.svg");
        case EnterpriseItemType.HTMLFormCategory:
          return this.getCustomIcon("html5.svg");
        case EnterpriseItemType.TableCategory:
          return vscode.ThemeIcon.Folder;
        case EnterpriseItemType.ClientScriptCategory:
          return this.getCustomIcon("js_docs.svg");
        case EnterpriseItemType.DataSourceCategory:
          return this.getCustomIcon("sql_docs.svg");
        case EnterpriseItemType.ServerScriptCategory:
          return this.getCustomIcon("ssl_docs.svg");
        default:
          return new vscode.ThemeIcon("folder-opened");
      }

    } else if (item.checkedOutBy) {
      return item.checkedOutBy === config.get("user") ? new vscode.ThemeIcon("unlock") : new vscode.ThemeIcon("lock");
    } else {
      switch (item.type) {
        case EnterpriseItemType.DataSource:
        case EnterpriseItemType.AppDataSource:
          return this.getCustomIcon("sql.svg");

        case EnterpriseItemType.Table:
          return this.getCustomIcon("db.svg");

        case EnterpriseItemType.ServerScript:
        case EnterpriseItemType.AppServerScript:
          return this.getCustomIcon("ssl.svg");

        case EnterpriseItemType.AppClientScript:
        case EnterpriseItemType.HTMLFormCode:
        case EnterpriseItemType.XFDFormCode:
          return this.getCustomIcon("js.svg");

        case EnterpriseItemType.XFDFormXML:
        case EnterpriseItemType.HTMLFormXML:
          return this.getCustomIcon("xml.svg");

        case EnterpriseItemType.HTMLFormGuide:
          return this.getCustomIcon("json.svg");

        case EnterpriseItemType.ServerLog:
          return new vscode.ThemeIcon("output");
        default:
          return new vscode.ThemeIcon("folder-opened");
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
  label?: string | vscode.TreeItemLabel | undefined;
  children?: TreeEnterpriseItem[];
  tooltip?: string | vscode.MarkdownString | undefined;
  isSystem?: boolean | undefined;
  iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri; } | vscode.ThemeIcon | undefined;

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
    this.label = label;
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

  AppServerScriptCategory = "ENT_APP_SS",
  AppServerScript = "APPSS",

  AppClientScriptCategory = "ENT_APP_CS",
  AppClientScript = "APPCS",

  AppDataSourceCategory = "ENT_APP_DS",
  AppDataSource = "APPDS",

  ClientScriptCategory = "CSCAT",
  ClientScript = "CS",

  DataSourceCategory = "DSCAT",
  DataSource = "DS",

  ServerScriptCategory = "SSCAT",
  ServerScript = "SS",

  XFDFormCategory = "ENT_APP_XFD_FRM",
  XFDFormXML = "XFDFORMXML",
  XFDFormCode = "XFDFORMCODE",

  HTMLFormCategory = "ENT_APP_HTML_FRM",
  HTMLFormXML = "HTMLFORMXML",
  HTMLFormCode = "HTMLFORMCODE",
  HTMLFormGuide = "HTMLFORMGUIDE",

  PhoneForm = "PHONEFORM",
  TabletForm = "TABLETFORM",

  ServerLog = "SERVERLOG",

  TableCategory = "TBLCATEGORY",
  Table = "TABLE"
}
