"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { EnterpriseItemType, TreeEnterpriseItem } from "./enterpriseTreeDataProvider";
import { DOMParser } from "@xmldom/xmldom";
import { EnterpriseService } from "../services/enterpriseService";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS Checked out tree.
 */
export class CheckedOutTreeDataProvider implements vscode.TreeDataProvider<TreeEnterpriseItem> {
  private data: TreeEnterpriseItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> =
    new vscode.EventEmitter<TreeEnterpriseItem | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeEnterpriseItem | null> = this._onDidChangeTreeData.event;

  constructor(xmlDS: string, private service: EnterpriseService) {
    this.data = this.getDataObject(xmlDS);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(item: TreeEnterpriseItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.label ?? "",
      (item.children?.length ?? 0) > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );
    treeItem.iconPath = item.iconPath;
    treeItem.contextValue = item.type;
    treeItem.label = item.checkedOutBy ? `${item.label} (Checked out by ${item.checkedOutBy})` : item.label;
    treeItem.resourceUri = this.getItemResource(item);
    treeItem.tooltip = item.tooltip;
    treeItem.command = item.command;
    return treeItem;
  }

  getChildren(item?: TreeEnterpriseItem): Thenable<TreeEnterpriseItem[] | undefined> {
    return (item && Promise.resolve(item.children ?? [])) || Promise.resolve(this.data);
  }

  /**
   * Get the icon path for the tree view item.
   * @param type Type of the tree view item.
   * @returns Icon path.
   */
  private getIconForType(type: EnterpriseItemType): vscode.ThemeIcon {
    switch (type) {
      case EnterpriseItemType.ServerScript:
      case EnterpriseItemType.AppServerScript:
      case EnterpriseItemType.AppClientScript:
      case EnterpriseItemType.HTMLFormCode:
      case EnterpriseItemType.XFDFormCode:
        return new vscode.ThemeIcon("file-code");

      case EnterpriseItemType.XFDFormXML:
      case EnterpriseItemType.HTMLFormXML:
        return new vscode.ThemeIcon("preview");

      case EnterpriseItemType.HTMLFormGuide:
        return new vscode.ThemeIcon("list-flat");

      case EnterpriseItemType.ServerLog:
        return new vscode.ThemeIcon("output");

      case EnterpriseItemType.AppDataSource:
      case EnterpriseItemType.DataSource:
      case EnterpriseItemType.Table:
        return new vscode.ThemeIcon("database");

      case EnterpriseItemType.EnterpriseCategory:
      case EnterpriseItemType.AppCategory:
        return new vscode.ThemeIcon("folder-opened");
      default:
        return new vscode.ThemeIcon("folder-opened");
    }
  }
  /**
   *  Returns a URI for the item if it is checked out by the current user.
   * @param item The item to check
   * @returns A URI for the item if it is checked out by the current user, otherwise undefined.
   */
  private getItemResource(item: any): vscode.Uri | undefined {
    const config = this.service.getConfig();
    let resourceUri = vscode.Uri.parse(`starlims:${item.tooltip}`);
    if (item.checkedOutBy && item.checkedOutBy === config.get("user")) {
      // change the color of the item
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByMe");
      item.color = new vscode.ThemeColor("gitDecoration.modifiedResourceForeground");
    } else if (item.checkedOutBy) {
      // change the color of the item
      resourceUri = vscode.Uri.parse("starlims:/checkedOutByOtherUser");
      item.color = new vscode.ThemeColor("gitDecoration.untrackedResourceForeground");
    }
    return resourceUri;
  }
  /**
   * Parse XML dataset string to create array of tree view data.
   * @param checkedOutItems XML dataset as string
   * @returns data object for tree view.
   */
  getDataObject(checkedOutItems: string): any {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(checkedOutItems, "text/xml");
    const pendingCheckins = xmlDoc.getElementsByTagName("PendingCheckins");
    const data: TreeEnterpriseItem[] = [];

    for (let i = 0; i < pendingCheckins.length; i++) {
      const childId = pendingCheckins[i].getElementsByTagName("CHILDID")[0]?.childNodes[0].nodeValue?.trim();
      const childName = pendingCheckins[i].getElementsByTagName("CHILDNAME")[0]?.childNodes[0].nodeValue?.trim();
      const checkedOutBy = pendingCheckins[i].getElementsByTagName("CHECKEDOUTBY")[0]?.childNodes[0].nodeValue?.trim();
      const childType = pendingCheckins[i].getElementsByTagName("CHILDTYPE")[0]?.childNodes[0].nodeValue?.trim();
      const parentID = pendingCheckins[i].getElementsByTagName("PARENTID")[0]?.childNodes[0].nodeValue?.trim();
      const parentName = pendingCheckins[i].getElementsByTagName("ParentName")[0]?.childNodes[0].nodeValue?.trim();
      const parentType = pendingCheckins[i].getElementsByTagName("PARENTTYPE")[0]?.childNodes[0].nodeValue?.trim();
      const checkedOutDate = pendingCheckins[i]
        .getElementsByTagName("CHECKEDOUTDATE")[0]
        ?.childNodes[0].nodeValue?.trim();
      const scriptLanguage = pendingCheckins[i]
        .getElementsByTagName("SCRIPTLANGUAGE")[0]
        ?.childNodes[0].nodeValue?.trim();
      const appCatName = pendingCheckins[i].getElementsByTagName("APPCATNAME")[0]?.childNodes[0].nodeValue?.trim();
      const issystem = pendingCheckins[i].getElementsByTagName("ISSYSTEM")[0]?.childNodes[0].nodeValue?.trim();

      // create a tree like:
      // - "Applications" > parentName > "HTML Forms" > childName (for parentType = "APP" and scriptLanguage = "HTML")
      // - "Applications" > parentName > "XFD Forms" > childName (for parentType = "APP" and scriptLanguage = "JSCRIPT")
      // - "Applications" > parentName > "Server Scripts" > childName (for parentType = "APP" and childType = "SERVERSCRIPT")
      // - "Applications" > parentName > "Client Scripts" > childName (for parentType = "APP" and childType = "CLIENTSCRIPT")
      // - "Applications" > parentName > "Data Sources" > childName (for parentType = "APP" and childType = "DATASOURCE")
      // - "Server Scripts" > parentName > childName (for parentType = "SSC")
      // - "Client Scripts" > parentName > childName (for parentType = "CSC")
      // - "Data Sources" > parentName > childName (for parentType = "DSC")

      if (parentType === "APP") {
        // create "Applications" category node
        let enterpriseCatNode = data.find((item: TreeEnterpriseItem) => item.label === "Applications");
        if (!enterpriseCatNode) {
          enterpriseCatNode = {
            label: "Applications",
            type: EnterpriseItemType.EnterpriseCategory,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.EnterpriseCategory),
            language: "",
            uri: "starlims://Applications/",
            guid: "",
            checkedOutBy: "",
            isSystem: false,
            filePath: ""
          };
          data.push(enterpriseCatNode);
        }

        // create application node (parent)
        let appNode = enterpriseCatNode.children?.find((item: TreeEnterpriseItem) => item.label === parentName);
        if (!appNode) {
          appNode = {
            label: parentName ?? "",
            type: EnterpriseItemType.AppCategory,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
            language: "",
            uri: `starlims://Applications//${parentName}`,
            guid: parentID ?? "",
            checkedOutBy: "",
            filePath: ""
          };
          enterpriseCatNode.children?.push(appNode);
        }

        if (scriptLanguage === "HTML") {
          // create HTML Forms node
          let htmlFormsNode = appNode.children?.find((item: TreeEnterpriseItem) => item.label === "HTML Forms");
          if (!htmlFormsNode) {
            htmlFormsNode = {
              label: "HTML Forms",
              type: EnterpriseItemType.AppCategory,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
              language: "",
              uri: `starlims://Applications//${appCatName}/${parentName}/HTML Forms`,
              guid: "",
              checkedOutBy: "",
              filePath: "",
              command: {
                command: "STARLIMS.selectEnterpriseItem",
                title: "Select Node",
                arguments: [this]
              }
            };
            appNode.children?.push(htmlFormsNode);
          }
          // create form node
          let formNode = htmlFormsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
          {
            formNode = {
              label: childName ?? "",
              type: EnterpriseItemType.HTMLFormCode,
              language: "JS",
              uri: `starlims://Applications//${appCatName}/${parentName}/HTML Forms/${childName}`,
              guid: childId ?? "",
              checkedOutBy: checkedOutBy ?? "",
              isSystem: issystem ? true : false,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.HTMLFormCode),
              filePath: "",
              tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
            };
            htmlFormsNode.children?.push(formNode);
          }
        } else if (scriptLanguage === "JSCRIPT") {
          // create XFD Forms node
          let xfdFormsNode = appNode.children?.find((item: TreeEnterpriseItem) => item.label === "XFD Forms");
          if (!xfdFormsNode) {
            xfdFormsNode = {
              label: "XFD Forms",
              type: EnterpriseItemType.AppCategory,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
              language: "",
              uri: `starlims://Applications//${appCatName}/${parentName}/XFD Forms`,
              guid: "",
              checkedOutBy: "",
              filePath: ""
            };
            appNode.children?.push(xfdFormsNode);
          }
          // create form node
          let formNode = xfdFormsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
          {
            formNode = {
              label: childName ?? "",
              type: EnterpriseItemType.XFDFormCode,
              language: "JS",
              uri: `starlims://Applications//${appCatName}/${parentName}/XFD Forms/${childName}`,
              guid: childId ?? "",
              checkedOutBy: checkedOutBy ?? "",
              isSystem: issystem ? true : false,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.XFDFormCode),
              filePath: "",
              tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
            };
            xfdFormsNode.children?.push(formNode);
          }
        }
        if (childType === "AppServerScript") {
          // create Server Scripts node
          let serverScriptsNode = appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Server Scripts");
          if (!serverScriptsNode) {
            serverScriptsNode = {
              label: "Server Scripts",
              type: EnterpriseItemType.AppCategory,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
              language: "",
              uri: `starlims://Applications//${appCatName}/${parentName}/Server Scripts`,
              guid: "",
              checkedOutBy: "",
              filePath: ""
            };
            appNode.children?.push(serverScriptsNode);
          }
          // create script node
          let scriptNode = serverScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
          {
            scriptNode = {
              label: childName ?? "",
              type: EnterpriseItemType.AppServerScript,
              language: "SSL",
              uri: `starlims://Applications//${appCatName}/${parentName}/Server Scripts/${childName}`,
              guid: childId ?? "",
              checkedOutBy: checkedOutBy ?? "",
              isSystem: issystem ? true : false,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppServerScript),
              filePath: "",
              tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
            };
            serverScriptsNode.children?.push(scriptNode);
          }
        }
        if (childType === "AppClientScript") {
          // create Client Scripts node
          let clientScriptsNode = appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Client Scripts");
          if (!clientScriptsNode) {
            clientScriptsNode = {
              label: "Client Scripts",
              type: EnterpriseItemType.AppCategory,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
              language: "",
              uri: `starlims://Applications//${appCatName}/${parentName}/Client Scripts`,
              guid: "",
              checkedOutBy: "",
              filePath: ""
            };
            appNode.children?.push(clientScriptsNode);
          }
          // create script node
          let scriptNode = clientScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
          {
            scriptNode = {
              label: childName ?? "",
              type: EnterpriseItemType.AppClientScript,
              language: "JS",
              uri: `starlims://Applications//${appCatName}/${parentName}/Client Scripts/${childName}`,
              guid: childId ?? "",
              checkedOutBy: checkedOutBy ?? "",
              isSystem: issystem ? true : false,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppClientScript),
              filePath: "",
              tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
            };
            clientScriptsNode.children?.push(scriptNode);
          }
        }
        if (childType === "AppDataSource") {
          // create "Data Sources" category node
          let dataSourcesNode = appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Data Sources");
          if (!dataSourcesNode) {
            dataSourcesNode = {
              label: "Data Sources",
              type: EnterpriseItemType.AppCategory,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppCategory),
              language: "",
              uri: `starlims://Applications//${appCatName}/${parentName}/Data Sources`,
              guid: "",
              checkedOutBy: "",
              filePath: ""
            };
            appNode.children?.push(dataSourcesNode);
          }
          // create data source node
          let dataSourceNode = dataSourcesNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
          {
            dataSourceNode = {
              label: childName ?? "",
              type: EnterpriseItemType.AppDataSource,
              language: scriptLanguage === "SQL" ? "SLSQL" : "SSL",
              uri: `starlims://Applications//${appCatName}/${parentName}/Data Sources/${childName}`,
              guid: childId ?? "",
              checkedOutBy: checkedOutBy ?? "",
              isSystem: issystem ? true : false,
              children: [],
              iconPath: this.getIconForType(EnterpriseItemType.AppDataSource),
              filePath: "",
              tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
            };
            dataSourcesNode.children?.push(dataSourceNode);
          }
        }
      }

      if (parentType === "SSC") {
        // create "Server Scripts" category node
        let enterpriseCatNode = data.find((item: TreeEnterpriseItem) => item.label === "Server Scripts");
        if (!enterpriseCatNode) {
          enterpriseCatNode = {
            label: "Server Scripts",
            type: EnterpriseItemType.EnterpriseCategory,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.EnterpriseCategory),
            language: "",
            uri: "starlims://ServerScripts/",
            guid: "",
            checkedOutBy: "",
            filePath: ""
          };
          data.push(enterpriseCatNode);
        }
        // create script node
        let scriptNode = enterpriseCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
        {
          scriptNode = {
            label: childName ?? "",
            type: EnterpriseItemType.ServerScript,
            language: "SSL",
            uri: `starlims://ServerScripts/${childName}`,
            guid: childId ?? "",
            checkedOutBy: checkedOutBy ?? "",
            isSystem: issystem ? true : false,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.ServerScript),
            filePath: "",
            tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
          };
          enterpriseCatNode.children?.push(scriptNode);
        }
      }

      if (parentType === "CSC") {
        // create "Client Scripts" category node
        let enterpriseCatNode = data.find((item: TreeEnterpriseItem) => item.label === "Client Scripts");
        if (!enterpriseCatNode) {
          enterpriseCatNode = {
            label: "Client Scripts",
            type: EnterpriseItemType.EnterpriseCategory,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.EnterpriseCategory),
            language: "",
            uri: "starlims://ClientScripts/",
            guid: "",
            checkedOutBy: "",
            filePath: ""
          };
          data.push(enterpriseCatNode);
        }
        // create script node
        let scriptNode = enterpriseCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
        {
          scriptNode = {
            label: childName ?? "",
            type: EnterpriseItemType.ServerScript,
            language: "JS",
            uri: `starlims://ClientScripts/${childName}`,
            guid: childId ?? "",
            checkedOutBy: checkedOutBy ?? "",
            isSystem: issystem ? true : false,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.ServerScript),
            filePath: "",
            tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
          };
          enterpriseCatNode.children?.push(scriptNode);
        }
      }

      if (parentType === "DSC") {
        // create "Data Sources" category node
        let enterpriseCatNode = data.find((item: TreeEnterpriseItem) => item.label === "Data Sources");
        if (!enterpriseCatNode) {
          enterpriseCatNode = {
            label: "Data Sources",
            type: EnterpriseItemType.EnterpriseCategory,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.EnterpriseCategory),
            language: "",
            uri: "starlims://DataSources/",
            guid: "",
            checkedOutBy: "",
            filePath: ""
          };
          data.push(enterpriseCatNode);
        }
        // create data source node
        let dataSourceNode = enterpriseCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
        {
          dataSourceNode = {
            label: childName ?? "",
            type: EnterpriseItemType.DataSource,
            language: scriptLanguage === "SQL" ? "SLSQL" : "SSL",
            uri: `starlims://DataSources/${childName}`,
            guid: childId ?? "",
            checkedOutBy: checkedOutBy ?? "",
            isSystem: issystem ? true : false,
            children: [],
            iconPath: this.getIconForType(EnterpriseItemType.DataSource),
            filePath: "",
            tooltip: `Checked out by ${checkedOutBy} on ${checkedOutDate}`
          };
          enterpriseCatNode.children?.push(dataSourceNode);
        }
      }
    }
    return data;
  }
}
