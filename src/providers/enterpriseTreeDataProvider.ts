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
        this.treeItems = await this.buildTreeFromSearchResults(resultItems);
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
   * @param item The element to return the children for.
   * @returns The children of the given element.
   */
  public async getChildren(item?: TreeEnterpriseItem): Promise<TreeEnterpriseItem[]> {
    var returnItems: TreeEnterpriseItem[] = [];
    let treeItems: TreeEnterpriseItem[] | undefined;

    // if no element is passed, start from root
    var uri: string = item ? item.uri : "";

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
      return (item && Promise.resolve(item.children ?? [])) || Promise.resolve(this.treeItems);
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

  /**
   * Get icon for type
   * @param type The type of the item to get the icon for
   * @returns The icon for the type
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
        var rootAppNode: TreeEnterpriseItem | undefined =
          returnItems.find((item) => item.label === "Applications") as TreeEnterpriseItem;

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
          rootAppNode.language = "";
          rootAppNode.guid = "";
          rootAppNode.checkedOutBy = "";
          rootAppNode.filePath = "";
          rootAppNode.isSystem = false;

          returnItems.push(rootAppNode);
        }

        // application category name
        var appCatName = uriParts[1];

        // create Application Category node if it doesn't exist
        var appCatNode: TreeEnterpriseItem | undefined = rootAppNode?.children?.find(
          (item: TreeEnterpriseItem) => item.label === appCatName
        );

        if (!appCatNode) {
          appCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppCategory,
            appCatName ?? "",
            "",
            "/Applications/" + uriParts[1] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          appCatNode.children = [];
          appCatNode.iconPath = _this.getIconForType(appCatNode.type, true);
          appCatNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [appCatNode]
          };

          rootAppNode?.children?.push(appCatNode as TreeEnterpriseItem);
        }

        // get application name
        var appName = uriParts[2];

        // create Application node
        var appNode: TreeEnterpriseItem | undefined = appCatNode?.children?.find(
          (item: TreeEnterpriseItem) => item.label === appName
        );

        if (!appNode) {
          appNode = new TreeEnterpriseItem(
            EnterpriseItemType.Application,
            appName ?? "",
            "",
            "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          appNode.children = [];
          appNode.iconPath = _this.getIconForType(appNode.type, true);
          appNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [appNode]
          };

          appCatNode?.children?.push(appNode as TreeEnterpriseItem);
        }

        // create "HTML Forms" node and sub nodes
        if (uriParts[3] === "HTMLForms") {
          var htmlFormsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "HTML Forms"
          );

          // node not found, create it
          if (!htmlFormsNode) {
            htmlFormsNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCategory,
              "HTML Forms",
              "",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/HTMLForms/",
              vscode.TreeItemCollapsibleState.Expanded
            );

            htmlFormsNode.children = [];
            htmlFormsNode.iconPath = _this.getIconForType(htmlFormsNode.type, true);
            htmlFormsNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [htmlFormsNode]
            };

            appNode?.children?.push(htmlFormsNode);
          }

          // create actual code behind node (not category)
          var codeBehindNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Code Behind"
          );

          // node not found, create it
          if (!codeBehindNode && uriParts[4] === "CodeBehind") {
            codeBehindNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCode,
              uriParts[5] + " [Code Behind]" ?? "",
              "JS",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/HTMLForms/CodeBehind/" + uriParts[5],
              vscode.TreeItemCollapsibleState.None
            );

            codeBehindNode.children = [];
            codeBehindNode.iconPath = _this.getIconForType(codeBehindNode.type, false);
            codeBehindNode.guid = item.guid;
            codeBehindNode.checkedOutBy = item.checkedOutBy;
            codeBehindNode.filePath = item.filePath;
            codeBehindNode.isSystem = item.isSystem;
            codeBehindNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [codeBehindNode]
            };

            htmlFormsNode?.children?.push(codeBehindNode);
          }

          // create HTML Form XML node
          var htmlFormXMLNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "XML"
          );

          // node not found, create it
          if (!htmlFormXMLNode && uriParts[4] === "XML") {
            htmlFormXMLNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormXML,
              uriParts[5] + " [XML]" ?? "",
              "XML",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/HTMLForms/XML/" + uriParts[5],
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormXMLNode.children = [];
            htmlFormXMLNode.iconPath = _this.getIconForType(htmlFormXMLNode.type, false);
            htmlFormXMLNode.guid = item.guid;
            htmlFormXMLNode.checkedOutBy = item.checkedOutBy;
            htmlFormXMLNode.filePath = item.filePath;
            htmlFormXMLNode.isSystem = item.isSystem;
            htmlFormXMLNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [htmlFormXMLNode]
            };

            htmlFormsNode?.children?.push(htmlFormXMLNode);
          }

          // create HTML Form Guide node
          var htmlFormGuideNode: TreeEnterpriseItem | undefined = htmlFormsNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Guide"
          );

          // node not found, create it
          if (!htmlFormGuideNode && uriParts[4] === "Guide") {
            htmlFormGuideNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormGuide,
              uriParts[5] + " [Guide]" ?? "",
              "JSON",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/HTMLForms/Guide/" + uriParts[5],
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormGuideNode.children = [];
            htmlFormGuideNode.iconPath = _this.getIconForType(htmlFormGuideNode.type, false);
            htmlFormGuideNode.guid = item.guid;
            htmlFormGuideNode.checkedOutBy = item.checkedOutBy;
            htmlFormGuideNode.filePath = item.filePath;
            htmlFormGuideNode.isSystem = item.isSystem;
            htmlFormGuideNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [htmlFormGuideNode]
            };

            htmlFormsNode?.children?.push(htmlFormGuideNode);
          }
        }

        // create "XFD Forms" node and sub nodes
        if (uriParts[3] === "XFDForms") {
          var xfdFormsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "XFD Forms"
          );

          // create "XFD Forms" node if "XFDForms" in uri
          if (!xfdFormsNode) {
            xfdFormsNode = new TreeEnterpriseItem(
              EnterpriseItemType.EnterpriseCategory,
              "XFD Forms",
              "",
              "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/XFDForms/",
              vscode.TreeItemCollapsibleState.Expanded
            );

            xfdFormsNode.children = [];
            xfdFormsNode.iconPath = _this.getIconForType(EnterpriseItemType.XFDFormCategory, true);
            xfdFormsNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [xfdFormsNode]
            };

            appNode?.children?.push(xfdFormsNode);

            // create actual code behind node
            let xfdCodeBehindNode: TreeEnterpriseItem | undefined = xfdFormsNode?.children?.find(
              (item: TreeEnterpriseItem) => item.label === "Code Behind"
            );

            // node not found, create it
            if (!xfdCodeBehindNode && uriParts[4] === "CodeBehind") {
              xfdCodeBehindNode = new TreeEnterpriseItem(
                EnterpriseItemType.XFDFormCode,
                uriParts[5] + " [Code Behind]" ?? "",
                "JS",
                "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/XFDForms/CodeBehind/" + uriParts[5],
                vscode.TreeItemCollapsibleState.None
              );

              xfdCodeBehindNode.children = [];
              xfdCodeBehindNode.iconPath = _this.getIconForType(xfdCodeBehindNode.type, false);
              xfdCodeBehindNode.guid = item.guid;
              xfdCodeBehindNode.checkedOutBy = item.checkedOutBy;
              xfdCodeBehindNode.filePath = item.filePath;
              xfdCodeBehindNode.isSystem = item.isSystem;
              xfdCodeBehindNode.command = {
                command: "STARLIMS.selectEnterpriseItem",
                title: "Open Item",
                arguments: [xfdCodeBehindNode]
              };

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
                uriParts[5] + " [XML]" ?? "",
                "XML",
                "/Applications/" + uriParts[1] + "/" + uriParts[2] + "/XFDForms/XML/" + uriParts[5],
                vscode.TreeItemCollapsibleState.None
              );

              xfdFormXMLNode.children = [];
              xfdFormXMLNode.iconPath = _this.getIconForType(xfdFormXMLNode.type, false);
              xfdFormXMLNode.guid = item.guid;
              xfdFormXMLNode.checkedOutBy = item.checkedOutBy;
              xfdFormXMLNode.filePath = item.filePath;
              xfdFormXMLNode.isSystem = item.isSystem;
              xfdFormXMLNode.command = {
                command: "STARLIMS.selectEnterpriseItem",
                title: "Open Item",
                arguments: [xfdFormXMLNode]
              };

              xfdFormsNode?.children?.push(xfdFormXMLNode);
            }
          }
        }

        // create "Server Scripts" node and sub nodes
        if (uriParts[3] === "ServerScripts") {
          var appServerScriptsNode: TreeEnterpriseItem | undefined = appNode?.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Server Scripts"
          );

          // not found, create it
          if (!appServerScriptsNode) {
            appServerScriptsNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppServerScriptCategory,
              "Server Scripts",
              "",
              `/Applications/${appCatName}/${appName}/ServerScripts/`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appServerScriptsNode.children = [];
            appServerScriptsNode.iconPath = _this.getIconForType(appServerScriptsNode.type, true);
            appServerScriptsNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [appServerScriptsNode]
            };

            appNode?.children?.push(appServerScriptsNode);
          }

          // create actual app server script node for XFD form
          let appServerScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppServerScript,
            uriParts[4],
            "SSL",
            `/Applications/${appCatName}/${appName}/ServerScripts/${uriParts[4]}`,
            vscode.TreeItemCollapsibleState.None
          );

          appServerScriptNode.children = [];
          appServerScriptNode.iconPath = _this.getIconForType(appServerScriptNode.type, false);
          appServerScriptNode.guid = item.guid;
          appServerScriptNode.checkedOutBy = item.checkedOutBy;
          appServerScriptNode.filePath = item.filePath;
          appServerScriptNode.isSystem = item.isSystem;
          appServerScriptNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [appServerScriptNode]
          };

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
              `/Applications/${appCatName}/${appName}/ClientScripts/`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appClientScriptsNode.children = [];
            appClientScriptsNode.iconPath = _this.getIconForType(appClientScriptsNode.type, true);
            appClientScriptsNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [appClientScriptsNode]
            };

            appNode?.children?.push(appClientScriptsNode);
          }

          // create actual app client script node for XFD form
          let appClientScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppClientScript,
            uriParts[4],
            "JS",
            `/Applications/${appCatName}/${appName}/ClientScripts/${uriParts[4]}`,
            vscode.TreeItemCollapsibleState.None
          );

          appClientScriptNode.children = [];
          appClientScriptNode.iconPath = _this.getIconForType(appClientScriptNode.type, false);
          appClientScriptNode.guid = item.guid;
          appClientScriptNode.checkedOutBy = item.checkedOutBy;
          appClientScriptNode.filePath = item.filePath;
          appClientScriptNode.isSystem = item.isSystem;
          appClientScriptNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [appClientScriptNode]
          };

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
              `/Applications/${appCatName}/${appName}/DataSources/`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appDataSourcesNode.children = [];
            appDataSourcesNode.iconPath = _this.getIconForType(appDataSourcesNode.type, true);
            appDataSourcesNode.command = {
              command: "STARLIMS.selectEnterpriseItem",
              title: "Open Item",
              arguments: [appDataSourcesNode]
            };

            appNode?.children?.push(appDataSourcesNode);
          }

          // create actual app data source node for XFD form
          let appDataSourceNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppDataSource,
            uriParts[4],
            "SQL",
            `/Applications/${appCatName}/${appName}/DataSources/${uriParts[4]}`,
            vscode.TreeItemCollapsibleState.None
          );

          appDataSourceNode.children = [];
          appDataSourceNode.iconPath = _this.getIconForType(appDataSourceNode.type, false);
          appDataSourceNode.guid = item.guid;
          appDataSourceNode.checkedOutBy = item.checkedOutBy;
          appDataSourceNode.filePath = item.filePath;
          appDataSourceNode.isSystem = item.isSystem;
          appDataSourceNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [appDataSourceNode]
          };

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
            "/ServerScripts/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbServerScriptsNode.children = [];
          glbServerScriptsNode.iconPath = _this.getIconForType(glbServerScriptsNode.type, true);
          glbServerScriptsNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbServerScriptsNode]
          };

          returnItems.push(glbServerScriptsNode);
        }

        // create server scripts category node
        let glbServerScriptCatNode: TreeEnterpriseItem | undefined = glbServerScriptsNode?.children?.find(
          (item) => item.label === uriParts[1]
        );

        // node not found, create it
        if (!glbServerScriptCatNode) {
          glbServerScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ServerScriptCategory,
            uriParts[1],
            "",
            "/ServerScripts/" + uriParts[1] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbServerScriptCatNode.children = [];
          glbServerScriptCatNode.iconPath = _this.getIconForType(glbServerScriptCatNode.type, true);
          glbServerScriptCatNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbServerScriptCatNode]
          };

          glbServerScriptsNode?.children?.push(glbServerScriptCatNode);
        }

        // create actual global server script node
        let glbServerScriptNode = new TreeEnterpriseItem(
          EnterpriseItemType.ServerScript,
          uriParts[2],
          "SSL",
          "/ServerScripts/" + uriParts[1] + "/" + uriParts[2],
          vscode.TreeItemCollapsibleState.None
        );

        glbServerScriptNode.children = [];
        glbServerScriptNode.iconPath = _this.getIconForType(glbServerScriptNode.type, false);
        glbServerScriptNode.guid = item.guid;
        glbServerScriptNode.checkedOutBy = item.checkedOutBy;
        glbServerScriptNode.filePath = item.filePath;
        glbServerScriptNode.isSystem = item.isSystem;
        glbServerScriptNode.command = {
          command: "STARLIMS.selectEnterpriseItem",
          title: "Open Item",
          arguments: [glbServerScriptNode]
        };

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
            "/ClientScripts/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbClientScriptsNode.children = [];
          glbClientScriptsNode.iconPath = _this.getIconForType(glbClientScriptsNode.type, true);
          glbClientScriptsNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbClientScriptsNode]
          };

          returnItems.push(glbClientScriptsNode);
        }

        // create client scripts category node
        let glbClientScriptCatNode: TreeEnterpriseItem | undefined = glbClientScriptsNode?.children?.find(
          (item) => item.label === uriParts[1]
        );

        // node not found, create it
        if (!glbClientScriptCatNode) {
          glbClientScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ClientScriptCategory,
            uriParts[1],
            "",
            "/ClientScripts/" + uriParts[1] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbClientScriptCatNode.children = [];
          glbClientScriptCatNode.iconPath = _this.getIconForType(glbClientScriptCatNode.type, true);
          glbClientScriptCatNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbClientScriptCatNode]
          };

          glbClientScriptsNode?.children?.push(glbClientScriptCatNode);
        }

        // create actual global client script node
        let glbClientScriptNode = new TreeEnterpriseItem(
          EnterpriseItemType.ClientScript,
          uriParts[2],
          "JS",
          "/ClientScripts/" + uriParts[1] + "/" + uriParts[2],
          vscode.TreeItemCollapsibleState.None
        );

        glbClientScriptNode.children = [];
        glbClientScriptNode.iconPath = _this.getIconForType(glbClientScriptNode.type, false);
        glbClientScriptNode.guid = item.guid;
        glbClientScriptNode.checkedOutBy = item.checkedOutBy;
        glbClientScriptNode.filePath = item.filePath;
        glbClientScriptNode.isSystem = item.isSystem;
        glbClientScriptNode.command = {
          command: "STARLIMS.selectEnterpriseItem",
          title: "Open Item",
          arguments: [glbClientScriptNode]
        };

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
            "/DataSources/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbDataSourcesNode.children = [];
          glbDataSourcesNode.iconPath = _this.getIconForType(glbDataSourcesNode.type, true);
          glbDataSourcesNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbDataSourcesNode]
          };

          returnItems.push(glbDataSourcesNode);
        }

        // create data sources category node
        let glbDataSourceCatNode: TreeEnterpriseItem | undefined = glbDataSourcesNode?.children?.find(
          (item) => item.label === uriParts[1]
        );

        // node not found, create it
        if (!glbDataSourceCatNode) {
          glbDataSourceCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.DataSourceCategory,
            uriParts[1],
            "",
            "/DataSources/" + uriParts[1] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          glbDataSourceCatNode.children = [];
          glbDataSourceCatNode.iconPath = _this.getIconForType(glbDataSourceCatNode.type, true);
          glbDataSourceCatNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [glbDataSourceCatNode]
          };

          glbDataSourcesNode?.children?.push(glbDataSourceCatNode);
        }

        // create actual global data source node
        let glbDataSourceNode = new TreeEnterpriseItem(
          EnterpriseItemType.DataSource,
          uriParts[2],
          "SQL",
          "/DataSources/" + uriParts[1] + "/" + uriParts[2],
          vscode.TreeItemCollapsibleState.None
        );

        glbDataSourceNode.children = [];
        glbDataSourceNode.iconPath = _this.getIconForType(glbDataSourceNode.type, false);
        glbDataSourceNode.guid = item.guid;
        glbDataSourceNode.checkedOutBy = item.checkedOutBy;
        glbDataSourceNode.filePath = item.filePath;
        glbDataSourceNode.isSystem = item.isSystem;
        glbDataSourceNode.command = {
          command: "STARLIMS.selectEnterpriseItem",
          title: "Open Item",
          arguments: [glbDataSourceNode]
        };

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
            "/Tables/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          tablesNode.children = [];
          tablesNode.iconPath = _this.getIconForType(tablesNode.type, true);
          tablesNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [tablesNode]
          };

          returnItems.push(tablesNode);
        }

        // create database node
        let tableDbNode: TreeEnterpriseItem | undefined = tablesNode?.children?.find(
          (item) => item.label === uriParts[1]
        );

        // node not found, create it
        if (!tableDbNode) {
          tableDbNode = new TreeEnterpriseItem(
            EnterpriseItemType.TableCategory,
            uriParts[1],
            "",
            "/Tables/" + uriParts[1] + "/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          tableDbNode.children = [];
          tableDbNode.iconPath = _this.getIconForType(tableDbNode.type, true);
          tableDbNode.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [tableDbNode]
          };

          tablesNode?.children?.push(tableDbNode);
        }

        // create actual global table node
        let tableNode = new TreeEnterpriseItem(
          EnterpriseItemType.Table,
          uriParts[2],
          "DB",
          "/Tables/" + uriParts[1] + "/" + uriParts[2],
          vscode.TreeItemCollapsibleState.None
        );

        tableNode.children = [];
        tableNode.iconPath = _this.getIconForType(tableNode.type, false);
        tableNode.guid = item.guid;
        tableNode.checkedOutBy = item.checkedOutBy;
        tableNode.filePath = item.filePath;
        tableNode.isSystem = item.isSystem;
        tableNode.command = {
          command: "STARLIMS.selectEnterpriseItem",
          title: "Open Item",
          arguments: [tableNode]
        };

        tableDbNode?.children?.push(tableNode);
      }
    };
    return returnItems;
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
