"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { IEnterpriseService } from "../services/iEnterpriseService";
import path from "path";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS designer tree explorer.
 */
export class EnterpriseTreeDataProvider implements vscode.TreeDataProvider<TreeEnterpriseItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> =
    new vscode.EventEmitter<TreeEnterpriseItem | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeEnterpriseItem | null> = this._onDidChangeTreeData.event;

  private service: IEnterpriseService;
  private dataMode: string = "LOAD";
  private treeItems: TreeEnterpriseItem[] = [];
  private resultItems: TreeEnterpriseItem[] = [];
  static service: any;

  /**
   * Class constructor
   * @param enterpriseService Enterprise service
   */
  constructor(enterpriseService: IEnterpriseService) {
    this.service = enterpriseService;
  }

  /**
   * Refresh tree
   */
  async refresh(): Promise<void> {
    this.resultItems = [];
    this.dataMode = "REFRESH";
    this._onDidChangeTreeData.fire(null);
  }

  /**
   * Clear tree
   */
  clear(): void {
    this.dataMode = "CLEAR";
    this._onDidChangeTreeData.fire(null);
  }

  /** Search for tree items on the server.
   * @param searchString The text to search for.
   * @param itemType The type of items to search for.
   * @returns First item found.
   * */
  async search(
    searchString: string,
    itemType: string,
    bSilent: boolean,
    bGlobal: boolean,
    bExactMatch: boolean = false
  ): Promise<TreeEnterpriseItem | undefined> {
    if (searchString === "") {
      return;
    }
    this.resultItems = [];
    if (bGlobal === true) {
      this.resultItems = await this.service.globalSearch(searchString, itemType);
    } else {
      this.resultItems = await this.service.searchForItems(searchString, itemType, bExactMatch);
    }
    if (this.resultItems.length === 0) {
      vscode.window.showErrorMessage("No items found!");
      return;
    } else {
      if (bSilent === false) {
        this.dataMode = "SEARCH";
        this.treeItems = await this.buildTreeFromSearchResults(this.resultItems);
        this._onDidChangeTreeData.fire(null);
      }
      return this.resultItems[0];
    }
  }

  /**
   *  Returns the children of the given element.
   * @param item The element to return the children for.
   * @returns The children of the given element.
   */
  public async getChildren(item?: TreeEnterpriseItem): Promise<TreeEnterpriseItem[]> {
    const _this = this;

    // load mode - load the current node's children
    if (this.dataMode === "LOAD" || this.dataMode === "REFRESH") {
      let uri: string = item ? item.uri : "";

      // refresh always starts from root
      if (this.dataMode === "REFRESH") {
        uri = "";
        this.dataMode = "LOAD";
      }

      let treeData = await this.service.getEnterpriseItems(uri, false);
      this.treeItems = [];

      // insert dummy item to show "No items found" message
      if (treeData.length === 0 || treeData === undefined) {
        let dummyItem = new TreeEnterpriseItem(
          EnterpriseItemType.EnterpriseCategory,
          "- No items found -",
          "",
          "",
          vscode.TreeItemCollapsibleState.None
        );
        this.treeItems.push(dummyItem);
        return this.treeItems;
      }

      // loop through the data and create new tree items
      treeData.forEach(function (item: any) {
        let newItem = new TreeEnterpriseItem(
          item.type,
          item.name,
          item.scriptLanguage,
          item.uri,
          item.isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          item.command,
          item.filePath,
          item.guid,
          item.language
        );

        newItem.contextValue = item.type;
        newItem.iconPath = _this.getItemIcon(item);
        let language = item.language ? ", Language: " + item.language : "";
        newItem.label = item.checkedOutBy
          ? `${newItem.label} (Checked out by ${item.checkedOutBy}${language})`
          : newItem.label;
        newItem.checkedOutBy = item.checkedOutBy;
        newItem.resourceUri = _this.getItemResource(item);

        // add the new item to the tree
        _this.treeItems.push(newItem);
      });
    }
    // clear mode - clear the tree
    else if (this.dataMode === "CLEAR") {
      this.treeItems = [];
    }
    // search mode - search for items
    else if (this.dataMode === "SEARCH") {
      if (this.treeItems.length === 0) {
        throw new Error("No items found!");
      }
      return (item && Promise.resolve(item.children ?? [])) || Promise.resolve(this.treeItems);
    }
    return this.treeItems;
  }

  /**
   * Returns the parent of the given element or undefined if no element is passed.
   * @param element The element to return the parent for.
   * @returns The parent of the given element or undefined if no element is passed.
   */
  getTreeItem(item: TreeEnterpriseItem): vscode.TreeItem {
    item.command = {
      command: "STARLIMS.selectEnterpriseItem",
      title: "Select Node",
      arguments: [item]
    };

    return item;
  }

  /**
   * Get corresponding tree item from local path
   * @param localPath The local path of the document
   * @param bSilent If true, no error message will be shown
   * @returns The tree item for the document
   */
  async getTreeItemFromPath(localPath: string, bSilent: boolean): Promise<TreeEnterpriseItem | undefined> {
    // get remote uri from local path
    let uri = await this.service.getUriFromLocalPath(localPath);
    uri = uri.replace(/\\/g, "/");

    // get tree item from the server
    const items = await this.service.getEnterpriseItems(uri, bSilent);
    
    // Check if items array is empty or the first item is undefined
    if (!items || items.length === 0 || !items[0]) {
      if (!bSilent) {
        console.warn(`No enterprise item found for path: ${localPath}`);
      }
      return undefined;
    }

    const item = items[0];

    let newItem = new TreeEnterpriseItem(
      item.type,
      item.name,
      item.scriptLanguage,
      item.uri,
      item.isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
      item.command,
      item.filePath,
      item.guid,
      item.language
    );

    newItem.checkedOutBy = item.checkedOutBy;

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
   * Search for tree item by its GUID
   * @param guid The GUID of the tree item to search for
   * @returns The tree item for the document
   */
  async getTreeItemByGuid(guid: string, itemType: EnterpriseItemType): Promise<TreeEnterpriseItem | undefined> {
    const enterpriseItems: TreeEnterpriseItem[] = this.treeItems;
    return enterpriseItems.find((item) => item.guid === guid && item.type === itemType);
  }

  /**
   * Returns a URI for the item if it is checked out by the current user.
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
   * Sets the item as checked out by the current user.
   * @param item The item to set as checked out by the current user.
   * @param bCheckedOut If true, the item will be checked out, otherwise it will be checked in.
   * @param sLang The language of the item.
   */
  public setItemCheckedOutStatus(item: any, bCheckedOut: boolean, sLang: string): void {
    const config = this.service.getConfig();
    const user = config.get("user");
    item.language = sLang;

    if (bCheckedOut === false) {
      item.checkedOutBy = undefined;
      item.color = undefined;
      item.resourceUri = undefined;
      // cut off the " (Checked out by ...)" string
      item.label = item.label.replace(/ \(Checked out by .*\)/g, "");
    } else {
      item.label = `${item.label} (Checked out by ${user}`;
      item.checkedOutBy = user;
      item.color = new vscode.ThemeColor("gitDecoration.modifiedResourceForeground");
      item.resourceUri = vscode.Uri.parse("starlims:/checkedOutByMe");

      // add language for forms only
      if (item.type.toUpperCase().includes("FORM")) {
        item.label += `, Language: ${sLang}`;
      }

      item.label += ")";
    }

    // apply changes to treeItems
    const enterpriseItems: TreeEnterpriseItem[] = this.treeItems;

    // find item in treeItems
    const foundItem = enterpriseItems.find((treeItem) => treeItem.uri === item.uri);

    // update item
    if (foundItem) {
      foundItem.checkedOutBy = item.checkedOutBy;
      foundItem.color = item.color;
      foundItem.label = item.label;
    }

    // refresh tree
    this._onDidChangeTreeData.fire(null);
  }

  /**
   *  Returns a custom icon for the item.
   * @param icon The name of the icon in the resources folder.
   * @returns  A custom icon for the item.
   */
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

        case EnterpriseItemType.ClientScript:
        case EnterpriseItemType.AppClientScript:
        case EnterpriseItemType.HTMLFormCode:
        case EnterpriseItemType.XFDFormCode:
          return this.getCustomIcon("js.svg");

        case EnterpriseItemType.XFDFormXML:
        case EnterpriseItemType.XFDFormResources:
        case EnterpriseItemType.HTMLFormXML:
        case EnterpriseItemType.HTMLFormResources:
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

  /**
   * Get icon for item type.
   * @param type The type of the item to get the icon for.
   * @returns The icon for the type.
   */
  private getIconForType(type: EnterpriseItemType, isFolder: boolean): any {
    // create dummy item to call getItemIcon
    const item = {
      type: type,
      isFolder: isFolder,
      name: ""
    };
    return this.getItemIcon(item);
  }

  /**
   * Build a tree from a list of uris.
   * @param uris The uris to build the tree from.
   * @returns The tree.
   */
  private async buildTreeFromSearchResults(searchResult: TreeEnterpriseItem[]): Promise<TreeEnterpriseItem[]> {
    // loop through the items and create new tree items
    const _this = this;
    let returnItems: TreeEnterpriseItem[] = [];

    // loop over search results
    for (let item of searchResult) {
      let uriParts = item.uri.substring(1, item.uri.length).split("/");

      // node is part from application
      if (uriParts[0] === "Applications") {
        let rootAppNode: TreeEnterpriseItem | undefined = returnItems.find(
          (item) => item.label === "Applications"
        ) as TreeEnterpriseItem;

        // create "Applications" node
        if (!rootAppNode) {
          rootAppNode = new TreeEnterpriseItem(
            EnterpriseItemType.EnterpriseCategory,
            "Applications",
            "",
            "/Applications/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          rootAppNode.children = [];
          rootAppNode.iconPath = _this.getIconForType(rootAppNode.type, true);
          returnItems.push(rootAppNode);
        }

        // application category name
        let appCatName = uriParts[1];

        // create application category node if it doesn't exist
        let appCatNode: TreeEnterpriseItem | undefined = rootAppNode?.children?.find(
          (item: TreeEnterpriseItem) => item.label === appCatName
        );

        if (!appCatNode) {
          appCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppCategory,
            appCatName ?? "",
            "",
            `/Applications/${appCatName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          appCatNode.children = [];
          appCatNode.iconPath = _this.getIconForType(appCatNode.type, true);
          rootAppNode?.children?.push(appCatNode as TreeEnterpriseItem);
        }

        // get application name
        let appName = uriParts[2];

        // create application node
        let appNode: TreeEnterpriseItem | undefined = appCatNode?.children?.find(
          (item: TreeEnterpriseItem) => item.label === appName
        );

        if (!appNode) {
          appNode = new TreeEnterpriseItem(
            EnterpriseItemType.Application,
            appName ?? "",
            "",
            `/Applications/${appCatName}/${appName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          appNode.children = [];
          appNode.iconPath = _this.getIconForType(appNode.type, true);
          appCatNode?.children?.push(appNode as TreeEnterpriseItem);
        }

        // create "HTML Forms" node and sub nodes
        if (uriParts[3] === "HTMLForms") {
          let htmlFormsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "HTML Forms"
          );

          // node not found, create it
          if (!htmlFormsNode) {
            htmlFormsNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCategory,
              "HTML Forms",
              "",
              `/Applications/${appCatName}/${appName}/HTMLForms`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            htmlFormsNode.children = [];
            htmlFormsNode.iconPath = _this.getIconForType(htmlFormsNode.type, true);
            appNode?.children?.push(htmlFormsNode);
          }

          // create actual code behind node (not category)
          let codeBehindNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Code Behind"
          );

          let formName = uriParts[5];

          // node not found, create it
          if (!codeBehindNode && uriParts[4] === "CodeBehind") {
            codeBehindNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCode,
              formName ? `${formName} [Code Behind]` : "",
              "JS",
              `/Applications/${appCatName}/${appName}/HTMLForms/CodeBehind/${formName}`,
              vscode.TreeItemCollapsibleState.None
            );

            codeBehindNode.children = [];
            codeBehindNode.iconPath = _this.getIconForType(codeBehindNode.type, false);
            codeBehindNode.guid = item.guid;
            codeBehindNode.checkedOutBy = item.checkedOutBy;
            codeBehindNode.filePath = item.filePath;
            codeBehindNode.isSystem = item.isSystem;
            codeBehindNode.globalSearchTerm = item.globalSearchTerm;
            htmlFormsNode?.children?.push(codeBehindNode);
          }

          // create HTML Form XML node
          let htmlFormXMLNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "XML"
          );

          // node not found, create it
          if (!htmlFormXMLNode && uriParts[4] === "XML") {
            htmlFormXMLNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormXML,
              formName ? `${formName} [XML]` : "",
              "XML",
              `/Applications/${appCatName}/${appName}/HTMLForms/XML/${formName}`,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormXMLNode.children = [];
            htmlFormXMLNode.iconPath = _this.getIconForType(htmlFormXMLNode.type, false);
            htmlFormXMLNode.guid = item.guid;
            htmlFormXMLNode.checkedOutBy = item.checkedOutBy;
            htmlFormXMLNode.filePath = item.filePath;
            htmlFormXMLNode.isSystem = item.isSystem;
            htmlFormsNode?.children?.push(htmlFormXMLNode);
          }

          // create HTML Form Guide node
          let htmlFormGuideNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Guide"
          );

          // node not found, create it
          if (!htmlFormGuideNode && uriParts[4] === "Guide") {
            htmlFormGuideNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormGuide,
              formName ? `${formName} [Guide]` : "",
              "JSON",
              `/Applications/${appCatName}/${appName}/HTMLForms/Guide/${formName}`,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormGuideNode.children = [];
            htmlFormGuideNode.iconPath = _this.getIconForType(htmlFormGuideNode.type, false);
            htmlFormGuideNode.guid = item.guid;
            htmlFormGuideNode.checkedOutBy = item.checkedOutBy;
            htmlFormGuideNode.filePath = item.filePath;
            htmlFormGuideNode.isSystem = item.isSystem;
            htmlFormsNode?.children?.push(htmlFormGuideNode);
          }
        }

        // create "XFD Forms" node and sub nodes
        if (uriParts[3] === "XFDForms") {
          let xfdFormsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "XFD Forms"
          );

          // create "XFD Forms" node if "XFDForms" in uri
          if (!xfdFormsNode) {
            xfdFormsNode = new TreeEnterpriseItem(
              EnterpriseItemType.EnterpriseCategory,
              "XFD Forms",
              "",
              `/Applications/${appCatName}/${appName}/XFDForms`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            xfdFormsNode.children = [];
            xfdFormsNode.iconPath = _this.getIconForType(EnterpriseItemType.XFDFormCategory, true);
            appNode?.children?.push(xfdFormsNode);

            // create actual code behind node
            let xfdCodeBehindNode: TreeEnterpriseItem | undefined = xfdFormsNode?.children?.find(
              (item: TreeEnterpriseItem) => item.label === "Code Behind"
            );

            let formName = uriParts[5];

            // node not found, create it
            if (!xfdCodeBehindNode && uriParts[4] === "CodeBehind") {
              xfdCodeBehindNode = new TreeEnterpriseItem(
                EnterpriseItemType.XFDFormCode,
                formName ? `${formName} [Code Behind]` : "",
                "JS",
                `/Applications/${appCatName}/${appName}/XFDForms/CodeBehind/${formName}`,
                vscode.TreeItemCollapsibleState.None
              );

              xfdCodeBehindNode.children = [];
              xfdCodeBehindNode.iconPath = _this.getIconForType(xfdCodeBehindNode.type, false);
              xfdCodeBehindNode.guid = item.guid;
              xfdCodeBehindNode.checkedOutBy = item.checkedOutBy;
              xfdCodeBehindNode.filePath = item.filePath;
              xfdCodeBehindNode.isSystem = item.isSystem;
              xfdCodeBehindNode.globalSearchTerm = item.globalSearchTerm;
              xfdFormsNode?.children?.push(xfdCodeBehindNode);
            }

            // create XFD Form XML node
            let xfdFormXMLNode: TreeEnterpriseItem | undefined = xfdFormsNode?.children?.find(
              (item: TreeEnterpriseItem) => item.label === "XML"
            );

            // node not found, create it
            if (!xfdFormXMLNode && uriParts[4] === "XML") {
              xfdFormXMLNode = new TreeEnterpriseItem(
                EnterpriseItemType.XFDFormXML,
                formName ? `${formName} [XML]` : "",
                "XML",
                `/Applications/${appCatName}/${appName}/XFDForms/XML/${formName}`,
                vscode.TreeItemCollapsibleState.None
              );

              xfdFormXMLNode.children = [];
              xfdFormXMLNode.iconPath = _this.getIconForType(xfdFormXMLNode.type, false);
              xfdFormXMLNode.guid = item.guid;
              xfdFormXMLNode.checkedOutBy = item.checkedOutBy;
              xfdFormXMLNode.filePath = item.filePath;
              xfdFormXMLNode.isSystem = item.isSystem;
              xfdFormsNode?.children?.push(xfdFormXMLNode);
            }
          }
        }

        // create "Server Scripts" node and sub nodes
        if (uriParts[3] === "ServerScripts") {
          let appServerScriptsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Server Scripts"
          );

          // not found, create it
          if (!appServerScriptsNode) {
            appServerScriptsNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppServerScriptCategory,
              "Server Scripts",
              "",
              `/Applications/${appCatName}/${appName}/ServerScripts`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appServerScriptsNode.children = [];
            appServerScriptsNode.iconPath = _this.getIconForType(appServerScriptsNode.type, true);
            appNode?.children?.push(appServerScriptsNode);
          }

          let scriptName = uriParts[4];

          // create actual app server script node
          let appServerScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppServerScript,
            scriptName,
            "SSL",
            `/Applications/${appCatName}/${appName}/ServerScripts/${scriptName}`,
            vscode.TreeItemCollapsibleState.None
          );

          appServerScriptNode.children = [];
          appServerScriptNode.iconPath = _this.getIconForType(appServerScriptNode.type, false);
          appServerScriptNode.guid = item.guid;
          appServerScriptNode.checkedOutBy = item.checkedOutBy;
          appServerScriptNode.filePath = item.filePath;
          appServerScriptNode.isSystem = item.isSystem;
          appServerScriptsNode?.children?.push(appServerScriptNode);
        }

        // create "Client Scripts" node and sub nodes
        if (uriParts[3] === "ClientScripts") {
          let appClientScriptsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Client Scripts"
          );

          // not found, create it
          if (!appClientScriptsNode) {
            appClientScriptsNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppClientScriptCategory,
              "Client Scripts",
              "",
              `/Applications/${appCatName}/${appName}/ClientScripts`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appClientScriptsNode.children = [];
            appClientScriptsNode.iconPath = _this.getIconForType(appClientScriptsNode.type, true);
            appNode?.children?.push(appClientScriptsNode);
          }

          let scriptName = uriParts[4];

          // create actual app client script node for XFD form
          let appClientScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppClientScript,
            scriptName,
            "JS",
            `/Applications/${appCatName}/${appName}/ClientScripts/${scriptName}`,
            vscode.TreeItemCollapsibleState.None
          );

          appClientScriptNode.iconPath = _this.getIconForType(appClientScriptNode.type, false);
          appClientScriptNode.guid = item.guid;
          appClientScriptNode.checkedOutBy = item.checkedOutBy;
          appClientScriptNode.filePath = item.filePath;
          appClientScriptNode.isSystem = item.isSystem;
          appClientScriptNode.globalSearchTerm = item.globalSearchTerm;
          appClientScriptsNode?.children?.push(appClientScriptNode);
        }

        // create "Data Sources" node and sub nodes
        if (uriParts[3] === "DataSources") {
          let appDataSourcesNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Data Sources"
          );

          // not found, create it
          if (!appDataSourcesNode) {
            appDataSourcesNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppDataSourceCategory,
              "Data Sources",
              "",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/DataSources",
              vscode.TreeItemCollapsibleState.Expanded
            );

            appDataSourcesNode.children = [];
            appDataSourcesNode.iconPath = _this.getIconForType(appDataSourcesNode.type, true);
            appNode?.children?.push(appDataSourcesNode);
          }

          let dsName = uriParts[4];

          // create actual app data source node for XFD form
          let appDataSourceNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppDataSource,
            dsName,
            "SQL",
            `/Applications/${appCatName}/${appName}/DataSources/${dsName}`,
            vscode.TreeItemCollapsibleState.None
          );

          appDataSourceNode.children = [];
          appDataSourceNode.iconPath = _this.getIconForType(appDataSourceNode.type, false);
          appDataSourceNode.guid = item.guid;
          appDataSourceNode.checkedOutBy = item.checkedOutBy;
          appDataSourceNode.filePath = item.filePath;
          appDataSourceNode.isSystem = item.isSystem;
          appDataSourceNode.globalSearchTerm = item.globalSearchTerm;
          appDataSourcesNode?.children?.push(appDataSourceNode);
        }
      }

      // create global "Server Scripts" node
      if (uriParts[0] === "ServerScripts") {
        let glbServerScriptsNode: TreeEnterpriseItem | undefined = returnItems.find(
          (item) => item.label === "Server Scripts"
        );

        // node not found, create it
        if (!glbServerScriptsNode) {
          glbServerScriptsNode = new TreeEnterpriseItem(
            EnterpriseItemType.EnterpriseCategory,
            "Server Scripts",
            "",
            "/ServerScripts",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbServerScriptsNode.children = [];
          glbServerScriptsNode.iconPath = _this.getIconForType(glbServerScriptsNode.type, true);
          returnItems.push(glbServerScriptsNode);
        }

        let scriptCatName = uriParts[1];

        // create server scripts category node
        let glbServerScriptCatNode: TreeEnterpriseItem | undefined = glbServerScriptsNode?.children?.find(
          (item) => item.label === scriptCatName
        );

        // node not found, create it
        if (!glbServerScriptCatNode) {
          glbServerScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ServerScriptCategory,
            scriptCatName,
            "",
            `/ServerScripts/${scriptCatName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbServerScriptCatNode.children = [];
          glbServerScriptCatNode.iconPath = _this.getIconForType(glbServerScriptCatNode.type, true);
          glbServerScriptsNode?.children?.push(glbServerScriptCatNode);
        }

        let scriptName = uriParts[2];

        // create actual global server script node
        let glbServerScriptNode = new TreeEnterpriseItem(
          EnterpriseItemType.ServerScript,
          scriptName,
          "SSL",
          `/ServerScripts/${scriptCatName}/${scriptName}`,
          vscode.TreeItemCollapsibleState.None
        );

        glbServerScriptNode.children = [];
        glbServerScriptNode.iconPath = _this.getIconForType(glbServerScriptNode.type, false);
        glbServerScriptNode.guid = item.guid;
        glbServerScriptNode.checkedOutBy = item.checkedOutBy;
        glbServerScriptNode.filePath = item.filePath;
        glbServerScriptNode.isSystem = item.isSystem;
        glbServerScriptNode.globalSearchTerm = item.globalSearchTerm;
        glbServerScriptCatNode?.children?.push(glbServerScriptNode);
      }

      // create global "Client Scripts" node
      if (uriParts[0] === "ClientScripts") {
        let glbClientScriptsNode: TreeEnterpriseItem | undefined = returnItems.find(
          (item) => item.label === "Client Scripts"
        );

        // node not found, create it
        if (!glbClientScriptsNode) {
          glbClientScriptsNode = new TreeEnterpriseItem(
            EnterpriseItemType.EnterpriseCategory,
            "Client Scripts",
            "",
            "/ClientScripts",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbClientScriptsNode.children = [];
          glbClientScriptsNode.iconPath = _this.getIconForType(glbClientScriptsNode.type, true);
          returnItems.push(glbClientScriptsNode);
        }

        let scriptCatName = uriParts[1];

        // create client scripts category node
        let glbClientScriptCatNode: TreeEnterpriseItem | undefined = glbClientScriptsNode?.children?.find(
          (item) => item.label === scriptCatName
        );

        // node not found, create it
        if (!glbClientScriptCatNode) {
          glbClientScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ClientScriptCategory,
            scriptCatName,
            "",
            `/ClientScripts/${scriptCatName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbClientScriptCatNode.children = [];
          glbClientScriptCatNode.iconPath = _this.getIconForType(glbClientScriptCatNode.type, true);
          glbClientScriptsNode?.children?.push(glbClientScriptCatNode);
        }

        let scriptName = uriParts[2];

        // create actual global client script node
        let glbClientScriptNode = new TreeEnterpriseItem(
          EnterpriseItemType.ClientScript,
          scriptName,
          "JS",
          `/ClientScripts/${scriptCatName}/${scriptName}`,
          vscode.TreeItemCollapsibleState.None
        );

        glbClientScriptNode.children = [];
        glbClientScriptNode.iconPath = _this.getIconForType(glbClientScriptNode.type, false);
        glbClientScriptNode.guid = item.guid;
        glbClientScriptNode.checkedOutBy = item.checkedOutBy;
        glbClientScriptNode.filePath = item.filePath;
        glbClientScriptNode.isSystem = item.isSystem;
        glbClientScriptNode.globalSearchTerm = item.globalSearchTerm;
        glbClientScriptCatNode?.children?.push(glbClientScriptNode);
      }

      // create global "Data Sources" node
      if (uriParts[0] === "DataSources") {
        let glbDataSourcesNode: TreeEnterpriseItem | undefined = returnItems.find(
          (item) => item.label === "Data Sources"
        );

        // node not found, create it
        if (!glbDataSourcesNode) {
          glbDataSourcesNode = new TreeEnterpriseItem(
            EnterpriseItemType.EnterpriseCategory,
            "Data Sources",
            "",
            "/DataSources",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbDataSourcesNode.children = [];
          glbDataSourcesNode.iconPath = _this.getIconForType(glbDataSourcesNode.type, true);
          returnItems.push(glbDataSourcesNode);
        }

        let dsCatName = uriParts[1];

        // create data sources category node
        let glbDataSourceCatNode: TreeEnterpriseItem | undefined = glbDataSourcesNode?.children?.find(
          (item) => item.label === dsCatName
        );

        // node not found, create it
        if (!glbDataSourceCatNode) {
          glbDataSourceCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.DataSourceCategory,
            dsCatName,
            "",
            `/DataSources/${dsCatName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbDataSourceCatNode.children = [];
          glbDataSourceCatNode.iconPath = _this.getIconForType(glbDataSourceCatNode.type, true);
          glbDataSourcesNode?.children?.push(glbDataSourceCatNode);
        }

        let dsName = uriParts[2];

        // create actual global data source node
        let glbDataSourceNode = new TreeEnterpriseItem(
          EnterpriseItemType.DataSource,
          dsName,
          "SQL",
          `/DataSources/${dsCatName}/${dsName}`,
          vscode.TreeItemCollapsibleState.None
        );

        glbDataSourceNode.children = [];
        glbDataSourceNode.iconPath = _this.getIconForType(glbDataSourceNode.type, false);
        glbDataSourceNode.guid = item.guid;
        glbDataSourceNode.checkedOutBy = item.checkedOutBy;
        glbDataSourceNode.filePath = item.filePath;
        glbDataSourceNode.isSystem = item.isSystem;
        glbDataSourceNode.globalSearchTerm = item.globalSearchTerm;
        glbDataSourceCatNode?.children?.push(glbDataSourceNode);
      }

      // create global "Tables" node
      if (uriParts[0] === "Tables") {
        let tablesNode: TreeEnterpriseItem | undefined = returnItems.find((item) => item.label === "Tables");

        // node not found, create it
        if (!tablesNode) {
          tablesNode = new TreeEnterpriseItem(
            EnterpriseItemType.EnterpriseCategory,
            "Tables",
            "",
            "/Tables",
            vscode.TreeItemCollapsibleState.Expanded
          );

          tablesNode.children = [];
          tablesNode.iconPath = _this.getIconForType(tablesNode.type, true);
          returnItems.push(tablesNode);
        }

        let dbName = uriParts[1];

        // create database node
        let tableDbNode: TreeEnterpriseItem | undefined = tablesNode?.children?.find((item) => item.label === dbName);

        // node not found, create it
        if (!tableDbNode) {
          tableDbNode = new TreeEnterpriseItem(
            EnterpriseItemType.TableCategory,
            dbName,
            "",
            `/Tables/${dbName}`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          tableDbNode.children = [];
          tableDbNode.iconPath = _this.getIconForType(tableDbNode.type, true);
          tablesNode?.children?.push(tableDbNode);
        }

        let tableName = uriParts[2];

        // create actual global table node
        let tableNode = new TreeEnterpriseItem(
          EnterpriseItemType.Table,
          tableName,
          "DB",
          `/Tables/${dbName}/${tableName}`,
          vscode.TreeItemCollapsibleState.None
        );

        tableNode.children = [];
        tableNode.iconPath = _this.getIconForType(tableNode.type, false);
        tableNode.guid = item.guid;
        tableNode.checkedOutBy = item.checkedOutBy;
        tableNode.filePath = item.filePath;
        tableNode.isSystem = item.isSystem;
        tableDbNode?.children?.push(tableNode);
      }
    }
    return returnItems;
  }
}

/**
 * Represents a tree item in the STARLIMS designer tree explorer.
 */
export class TreeEnterpriseItem extends vscode.TreeItem {
  type: EnterpriseItemType;
  scriptLanguage: string;
  language: string;
  uri: string;
  filePath: string | undefined;
  checkedOutBy: string | undefined;
  guid: string | undefined;
  label?: string | vscode.TreeItemLabel | undefined;
  children?: TreeEnterpriseItem[];
  tooltip?: string | vscode.MarkdownString | undefined;
  isSystem?: boolean | undefined;
  iconPath?:
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri }
    | vscode.ThemeIcon
    | undefined;
  globalSearchTerm?: string | undefined;
  color?: string | undefined;

  constructor(
    type: EnterpriseItemType,
    label: string,
    scriptLanguage: string,
    uri: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    filePath?: string,
    guid?: string,
    language?: string
  ) {
    super(label, collapsibleState);
    this.label = label;
    this.type = type;
    this.scriptLanguage = scriptLanguage;
    this.command = command;
    this.uri = uri;
    this.filePath = filePath;
    this.guid = guid;
    this.language = language ?? "";
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
  XFDFormResources = "XFDFORMRESOURCES",

  HTMLFormCategory = "ENT_APP_HTML_FRM",
  HTMLFormXML = "HTMLFORMXML",
  HTMLFormCode = "HTMLFORMCODE",
  HTMLFormGuide = "HTMLFORMGUIDE",
  HTMLFormResources = "HTMLFORMRESOURCES",

  PhoneForm = "PHONEFORM",
  TabletForm = "TABLETFORM",

  ServerLog = "SERVERLOG",

  TableCategory = "TBLCATEGORY",
  Table = "TABLE"
}
