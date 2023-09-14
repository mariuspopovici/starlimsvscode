"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { EnterpriseItemType, TreeEnterpriseItem } from "./enterpriseTreeDataProvider";
import { DOMParser } from "@xmldom/xmldom";
import { EnterpriseService } from "../services/enterpriseService";
import path from "path";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS Checked out tree.
 */
export class CheckedOutTreeDataProvider implements vscode.TreeDataProvider<TreeEnterpriseItem> {
  private data: TreeEnterpriseItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> =
    new vscode.EventEmitter<TreeEnterpriseItem | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeEnterpriseItem | null> = this._onDidChangeTreeData.event;

  /**
   * Constructor for CheckedOutTreeDataProvider.
   * @param xmlDS XML dataset as string
   * @param service EnterpriseService
   * @returns CheckedOutTreeDataProvider
  */
  constructor(xmlDS: string, private service: EnterpriseService) {
    this.data = this.getDataObject(xmlDS);
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  /**
   * Get the a view item.
   * @param item Tree view item as TreeEnterpriseItem
   * @returns Tree view item as vscode.TreeItem
   */
  getTreeItem(item: TreeEnterpriseItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.label ?? "",
      (item.children?.length ?? 0) > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );
    treeItem.iconPath = item.iconPath;
    treeItem.contextValue = item.type;
    let language = item.language? ", Language: " + item.language : "";
    treeItem.label = item.checkedOutBy ? `${item.label} (Checked out by ${item.checkedOutBy}${language})` : item.label;
    treeItem.resourceUri = this.getItemResource(item);
    treeItem.tooltip = item.tooltip ?? item.label?.toString() ?? "";
    treeItem.command = {
      command: "STARLIMS.selectEnterpriseItem",
      title: "Open File",
      arguments: [item]
    };
    return treeItem;
  }

  /**
   * Get the children of the tree view item.
   * @param item Tree view item
   * @returns Children of the tree view item.
   */
  getChildren(item?: TreeEnterpriseItem): Thenable<TreeEnterpriseItem[] | undefined> {
    return (item && Promise.resolve(item.children ?? [])) || Promise.resolve(this.data);
  }

  /**
   * Get the icon path for the tree view item.
   * @param icon Icon name
   * @returns Icon path
   */
  private getCustomIcon(icon: string): any {
    return {
      light: path.join(__filename, "..", "..", "resources", "light", icon),
      dark: path.join(__filename, "..", "..", "resources", "dark", icon)
    };
  }

  /**
    * Get the icon path for the tree view item.
    * @param type Type of the tree view item.
    * @returns Icon path.
    */
  private getIconForType(type: EnterpriseItemType): any {
    switch (type) {
      case EnterpriseItemType.Application:
        return this.getCustomIcon("app.svg");

      case EnterpriseItemType.AppCategory:
        return this.getCustomIcon("apps.svg");

      case EnterpriseItemType.ClientScriptCategory:
      case EnterpriseItemType.AppClientScriptCategory:
        return this.getCustomIcon("js_docs.svg");

      case EnterpriseItemType.ServerScriptCategory:
      case EnterpriseItemType.AppServerScriptCategory:
        return this.getCustomIcon("ssl_docs.svg");

      case EnterpriseItemType.DataSourceCategory:
      case EnterpriseItemType.AppDataSourceCategory:
        return this.getCustomIcon("sql_docs.svg");

      case EnterpriseItemType.XFDFormCategory:
        return this.getCustomIcon("xfd_form.svg");

      case EnterpriseItemType.HTMLFormCategory:
        return this.getCustomIcon("html5.svg");

      case EnterpriseItemType.XFDFormCode:
      case EnterpriseItemType.HTMLFormCode:
      case EnterpriseItemType.ClientScript:
      case EnterpriseItemType.AppClientScript:
        return this.getCustomIcon("js.svg");

      case EnterpriseItemType.HTMLFormGuide:
        return this.getCustomIcon("json.svg");

      case EnterpriseItemType.XFDFormXML:
      case EnterpriseItemType.XFDFormResources:
      case EnterpriseItemType.HTMLFormXML:
      case EnterpriseItemType.HTMLFormResources:
        return this.getCustomIcon("xml.svg");

      case EnterpriseItemType.ServerScript:
      case EnterpriseItemType.AppServerScript:
        return this.getCustomIcon("ssl.svg");

      case EnterpriseItemType.DataSource:
      case EnterpriseItemType.AppDataSource:
        return this.getCustomIcon("sql.svg");

      default:
        return new vscode.ThemeIcon("folder-opened");
    }
  }

  /**
   * Returns a URI for the item if it is checked out by the current user.
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
      const checkedOutDate = pendingCheckins[i].getElementsByTagName("CHECKEDOUTDATE")[0]?.childNodes[0].nodeValue?.trim();
      const scriptLanguage = pendingCheckins[i].getElementsByTagName("SCRIPTLANGUAGE")[0]?.childNodes[0].nodeValue?.trim();
      const appCatName = pendingCheckins[i].getElementsByTagName("APPCATNAME")[0]?.childNodes[0].nodeValue?.trim();
      const isSystem = pendingCheckins[i].getElementsByTagName("ISSYSTEM")[0]?.childNodes[0].nodeValue?.trim();
      const language = pendingCheckins[i].getElementsByTagName("LANGID")[0]?.childNodes[0].nodeValue?.trim();

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
        var rootNode: TreeEnterpriseItem | undefined = data.find(
          (item: TreeEnterpriseItem) => item.label === "Applications"
        );

        if (!rootNode) {
          rootNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppCategory,
            "Applications",
            "",
            "/Applications/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          rootNode.children = [];
          rootNode.iconPath = this.getIconForType(rootNode.type);
          rootNode.scriptLanguage = "";
          rootNode.guid = "";
          rootNode.checkedOutBy = "";
          rootNode.filePath = "";
          rootNode.isSystem = false;

          data.push(rootNode as TreeEnterpriseItem);
        }

        // create application category node
        var appCatNode: TreeEnterpriseItem | undefined = rootNode?.children?.find(
          (item: TreeEnterpriseItem) => item.label === appCatName && item.type === EnterpriseItemType.AppCategory
        );

        if (!appCatNode) {
          appCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.AppCategory,
            appCatName ?? "",
            "",
            `/Applications/${appCatName}/`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          appCatNode.children = [];
          appCatNode.iconPath = this.getIconForType(appCatNode.type);
          appCatNode.scriptLanguage = "";
          appCatNode.guid = "";
          appCatNode.checkedOutBy = "";
          appCatNode.filePath = "";
          appCatNode.isSystem = isSystem ? true : false;

          rootNode?.children?.push(appCatNode as TreeEnterpriseItem);
        }

        // create application node
        var appNode: TreeEnterpriseItem | undefined = appCatNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === parentName && item.type === EnterpriseItemType.Application
        );

        if (!appNode) {
          appNode = new TreeEnterpriseItem(
            EnterpriseItemType.Application,
            parentName ?? "",
            "",
            `/Applications/${appCatName}/${parentName}/`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          appNode.children = [];
          appNode.iconPath = this.getIconForType(appNode.type);
          appNode.scriptLanguage = "";
          appNode.guid = parentID ?? "";
          appNode.checkedOutBy = "";
          appNode.filePath = "";
          appNode.isSystem = isSystem ? true : false;

          appCatNode.children?.push(appNode as TreeEnterpriseItem);
        }

        if (scriptLanguage === "HTML") {
          // create "HTML Forms" node
          var htmlFormsCatNode: TreeEnterpriseItem | undefined = appNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === "HTML Forms" && item.type === EnterpriseItemType.HTMLFormCategory
          );

          if (!htmlFormsCatNode) {
            htmlFormsCatNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCategory,
              "HTML Forms",
              "",
              `/Applications/${appCatName}/${parentName}/HTMLForms`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            htmlFormsCatNode.children = [];
            htmlFormsCatNode.iconPath = this.getIconForType(htmlFormsCatNode.type);
            htmlFormsCatNode.scriptLanguage = "";
            htmlFormsCatNode.guid = "";
            htmlFormsCatNode.checkedOutBy = "";
            htmlFormsCatNode.filePath = "";
            htmlFormsCatNode.isSystem = false;

            appNode.children?.push(htmlFormsCatNode as TreeEnterpriseItem);
          }

          // create HTML form XML node
          var htmlFormXmlNode: TreeEnterpriseItem | undefined = htmlFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.HTMLFormXML
          );
          {
            let uri = `/Applications/${appCatName}/${parentName}/HTMLForms/XML/${childName}`;

            htmlFormXmlNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormXML,
              childName + " [XML]",
              "XML",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormXmlNode.guid = childId ?? "";
            htmlFormXmlNode.checkedOutBy = checkedOutBy ?? "";
            htmlFormXmlNode.isSystem = isSystem ? true : false;
            htmlFormXmlNode.children = [];
            htmlFormXmlNode.iconPath = this.getIconForType(htmlFormXmlNode.type);
            htmlFormXmlNode.filePath = "";
            htmlFormXmlNode.language = language ?? "";
            htmlFormXmlNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            htmlFormsCatNode.children?.push(htmlFormXmlNode);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }

          // create HTML form code behind node
          var htmlFormCodeNode: TreeEnterpriseItem | undefined = htmlFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.HTMLFormCode
          );
          {
            let uri = `/Applications/${appCatName}/${parentName}/HTMLForms/CodeBehind/${childName}`;

            htmlFormCodeNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormCode,
              childName + " [Code Behind]",
              "JS",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormCodeNode.guid = childId ?? "";
            htmlFormCodeNode.checkedOutBy = checkedOutBy ?? "";
            htmlFormCodeNode.isSystem = isSystem ? true : false;
            htmlFormCodeNode.children = [];
            htmlFormCodeNode.iconPath = this.getIconForType(htmlFormCodeNode.type);
            htmlFormCodeNode.filePath = "";
            htmlFormCodeNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            htmlFormsCatNode.children?.push(htmlFormCodeNode);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }

          // create HTML form guide node
          var htmlFormGuideNode: TreeEnterpriseItem | undefined = htmlFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.HTMLFormGuide
          );
          {
            let uri = `/Applications/${appCatName}/${parentName}/HTMLForms/Guide/${childName}`;

            htmlFormGuideNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormGuide,
              childName + " [Guide]",
              "GUIDE",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormGuideNode.guid = childId ?? "";
            htmlFormGuideNode.checkedOutBy = checkedOutBy ?? "";
            htmlFormGuideNode.isSystem = isSystem ? true : false;
            htmlFormGuideNode.children = [];
            htmlFormGuideNode.iconPath = this.getIconForType(htmlFormGuideNode.type);
            htmlFormGuideNode.filePath = "";
            htmlFormGuideNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;
            htmlFormGuideNode.language = language ?? "";

            htmlFormsCatNode.children?.push(htmlFormGuideNode);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }

          // create HTML form resources node
          var htmlFormResourcesNode: TreeEnterpriseItem | undefined = htmlFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.HTMLFormResources
          );
          {
            let uri = `/Applications/${appCatName}/${parentName}/HTMLForms/Resources/${childName}`;

            htmlFormResourcesNode = new TreeEnterpriseItem(
              EnterpriseItemType.HTMLFormResources,
              childName + " [Resources]",
              "XML",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            htmlFormResourcesNode.guid = childId ?? "";
            htmlFormResourcesNode.checkedOutBy = checkedOutBy ?? "";
            htmlFormResourcesNode.isSystem = isSystem ? true : false;
            htmlFormResourcesNode.children = [];
            htmlFormResourcesNode.iconPath = this.getIconForType(htmlFormResourcesNode.type);
            htmlFormResourcesNode.filePath = "";
            htmlFormResourcesNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;
            htmlFormResourcesNode.language = language ?? "";

            htmlFormsCatNode.children?.push(htmlFormResourcesNode);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }
        } else if (scriptLanguage === "XFD") {
          // create "XFD Forms" node
          var xfdFormsCatNode: TreeEnterpriseItem | undefined = appNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === "XFD Forms" && item.type === EnterpriseItemType.XFDFormCategory
          );

          if (!xfdFormsCatNode) {
            xfdFormsCatNode = new TreeEnterpriseItem(
              EnterpriseItemType.XFDFormCategory,
              "XFD Forms",
              "",
              `/Applications/${appCatName}/${parentName}/XFDForms`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            xfdFormsCatNode.children = [];
            xfdFormsCatNode.iconPath = this.getIconForType(xfdFormsCatNode.type);
            xfdFormsCatNode.scriptLanguage = "";
            xfdFormsCatNode.guid = "";
            xfdFormsCatNode.checkedOutBy = "";
            xfdFormsCatNode.filePath = "";
            xfdFormsCatNode.isSystem = false;

            appNode.children?.push(xfdFormsCatNode as TreeEnterpriseItem);
          }

          // create XFD form XML node
          var xfdFormXmlNode: TreeEnterpriseItem | undefined = xfdFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.XFDFormXML
          );

          if (!xfdFormXmlNode) {
            let uri = `/Applications/${appCatName}/${parentName}/XFDForms/XML/${childName}`;
            
            xfdFormXmlNode = new TreeEnterpriseItem(
              EnterpriseItemType.XFDFormXML,
              childName + " [XML]",
              "XML",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            xfdFormXmlNode.guid = childId ?? "";
            xfdFormXmlNode.checkedOutBy = checkedOutBy ?? "";
            xfdFormXmlNode.isSystem = isSystem ? true : false;
            xfdFormXmlNode.children = [];
            xfdFormXmlNode.iconPath = this.getIconForType(EnterpriseItemType.XFDFormXML);
            xfdFormXmlNode.filePath = "";
            xfdFormXmlNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;
            xfdFormXmlNode.language = language ?? "";

            xfdFormsCatNode.children?.push(xfdFormXmlNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }

          // create XFD form code behind node
          var xfdFormCodeNode: TreeEnterpriseItem | undefined = xfdFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.XFDFormCode
          );

          if (!xfdFormCodeNode) {
            let uri = `/Applications/${appCatName}/${parentName}/XFDForms/CodeBehind/${childName}`;
            xfdFormCodeNode = new TreeEnterpriseItem(
              EnterpriseItemType.XFDFormCode,
              childName + " [Code Behind]",
              "JS",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            xfdFormCodeNode.guid = childId ?? "";
            xfdFormCodeNode.checkedOutBy = checkedOutBy ?? "";
            xfdFormCodeNode.isSystem = isSystem ? true : false;
            xfdFormCodeNode.children = [];
            xfdFormCodeNode.iconPath = this.getIconForType(xfdFormCodeNode.type);
            xfdFormCodeNode.filePath = "";
            xfdFormCodeNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            xfdFormsCatNode.children?.push(xfdFormCodeNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }

          // create XFD form resources node
          var xfdFormResourcesNode: TreeEnterpriseItem | undefined = xfdFormsCatNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.XFDFormResources
          );

          if (!xfdFormResourcesNode) {
            let uri = `/Applications/${appCatName}/${parentName}/XFDForms/Resources/${childName}`;
            xfdFormResourcesNode = new TreeEnterpriseItem(
              EnterpriseItemType.XFDFormResources,
              childName + " [Resources]",
              "XML",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            xfdFormResourcesNode.guid = childId ?? "";
            xfdFormResourcesNode.checkedOutBy = checkedOutBy ?? "";
            xfdFormResourcesNode.isSystem = isSystem ? true : false;
            xfdFormResourcesNode.children = [];
            xfdFormResourcesNode.iconPath = this.getIconForType(xfdFormResourcesNode.type);
            xfdFormResourcesNode.filePath = "";
            xfdFormResourcesNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;
            xfdFormResourcesNode.language = language ?? "";

            xfdFormsCatNode.children?.push(xfdFormResourcesNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }
        }

        if (childType === "AppServerScript") {
          // create "Server Scripts" node
          var appServerScriptsNode: TreeEnterpriseItem | undefined = appNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Server Scripts" && item.type === EnterpriseItemType.AppServerScriptCategory
          );

          if (!appServerScriptsNode) {
            appServerScriptsNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppServerScriptCategory,
              "Server Scripts",
              "",
              `/Applications/${appCatName}/${parentName}/ServerScripts`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appServerScriptsNode.children = [];
            appServerScriptsNode.iconPath = this.getIconForType(appServerScriptsNode.type);
            appServerScriptsNode.scriptLanguage = "";
            appServerScriptsNode.guid = "";
            appServerScriptsNode.checkedOutBy = "";
            appServerScriptsNode.filePath = "";
            appServerScriptsNode.isSystem = false;

            appNode.children?.push(appServerScriptsNode as TreeEnterpriseItem);
          }

          // create server script node
          var appServerScriptNode: TreeEnterpriseItem | undefined = appServerScriptsNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.AppServerScript
          );

          if (!appServerScriptNode) {
            let uri = `/Applications/${appCatName}/${parentName}/ServerScripts/${childName}`;

            appServerScriptNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppServerScript,
              childName ?? "",
              "SSL",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            appServerScriptNode.guid = childId ?? "";
            appServerScriptNode.checkedOutBy = checkedOutBy ?? "";
            appServerScriptNode.isSystem = isSystem ? true : false;
            appServerScriptNode.children = [];
            appServerScriptNode.iconPath = this.getIconForType(appServerScriptNode.type);
            appServerScriptNode.filePath = "";
            appServerScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            appServerScriptsNode.children?.push(appServerScriptNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }
        }

        if (childType === "AppClientScript") {
          // create "Client Scripts" node
          var appClientScriptsNode: TreeEnterpriseItem | undefined = appNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Client Scripts" && item.type === EnterpriseItemType.AppClientScriptCategory
          );

          if (!appClientScriptsNode) {
            appClientScriptsNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppClientScriptCategory,
              "Client Scripts",
              "",
              `/Applications/${appCatName}/${parentName}/ClientScripts`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appClientScriptsNode.children = [];
            appClientScriptsNode.iconPath = this.getIconForType(appClientScriptsNode.type);
            appClientScriptsNode.scriptLanguage = "";
            appClientScriptsNode.guid = "";
            appClientScriptsNode.checkedOutBy = "";
            appClientScriptsNode.filePath = "";
            appClientScriptsNode.isSystem = false;

            appNode.children?.push(appClientScriptsNode as TreeEnterpriseItem);
          }

          // create client script node
          var appClientScriptNode: TreeEnterpriseItem | undefined = appClientScriptsNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.AppClientScript
          );

          if (!appClientScriptNode) {
            let uri = `/Applications/${appCatName}/${parentName}/ClientScripts/${childName}`;

            appClientScriptNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppClientScript,
              childName ?? "",
              "JS",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            appClientScriptNode.guid = childId ?? "";
            appClientScriptNode.checkedOutBy = checkedOutBy ?? "";
            appClientScriptNode.isSystem = isSystem ? true : false;
            appClientScriptNode.children = [];
            appClientScriptNode.iconPath = this.getIconForType(appClientScriptNode.type);
            appClientScriptNode.filePath = "";
            appClientScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            appClientScriptsNode.children?.push(appClientScriptNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }
        }

        if (childType === "AppDataSource") {
          // create "Data Sources" node
          var appDataSourcesNode: TreeEnterpriseItem | undefined = appNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === "Data Sources" && item.type === EnterpriseItemType.AppDataSourceCategory
          );

          if (!appDataSourcesNode) {
            appDataSourcesNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppDataSourceCategory,
              "Data Sources",
              "",
              `/Applications/${appCatName}/${parentName}/DataSources`,
              vscode.TreeItemCollapsibleState.Expanded
            );

            appDataSourcesNode.children = [];
            appDataSourcesNode.iconPath = this.getIconForType(appDataSourcesNode.type);
            appDataSourcesNode.scriptLanguage = "";
            appDataSourcesNode.guid = "";
            appDataSourcesNode.checkedOutBy = "";
            appDataSourcesNode.filePath = "";
            appDataSourcesNode.isSystem = false;

            appNode.children?.push(appDataSourcesNode as TreeEnterpriseItem);
          }

          // create data source node
          var appDataSourceNode: TreeEnterpriseItem | undefined = appDataSourcesNode.children?.find(
            (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.AppDataSource
          );

          if (!appDataSourceNode) {
            let uri = `/Applications/${appCatName}/${parentName}/DataSources/${childName}`;
            appDataSourceNode = new TreeEnterpriseItem(
              EnterpriseItemType.AppDataSource,
              childName ?? "",
              scriptLanguage === "SQL" ? "SLSQL" : "SSL",
              uri,
              vscode.TreeItemCollapsibleState.None
            );

            appDataSourceNode.guid = childId ?? "";
            appDataSourceNode.checkedOutBy = checkedOutBy ?? "";
            appDataSourceNode.isSystem = isSystem ? true : false;
            appDataSourceNode.children = [];
            appDataSourceNode.iconPath = this.getIconForType(appDataSourceNode.type);
            appDataSourceNode.filePath = "";
            appDataSourceNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

            appDataSourcesNode.children?.push(appDataSourceNode as TreeEnterpriseItem);
            this.service.setCheckedOut(uri, checkedOutBy ?? "");
          }
        }
      }

      if (parentType === "SSC") {
        // create "Server Scripts" root node
        var serverScriptsNode: TreeEnterpriseItem | undefined = data.find(
          (item: TreeEnterpriseItem) => item.label === "Server Scripts" && item.type === EnterpriseItemType.ServerScriptCategory
        );

        if (!serverScriptsNode) {
          serverScriptsNode = new TreeEnterpriseItem(
            EnterpriseItemType.ServerScriptCategory,
            "Server Scripts",
            "",
            "/ServerScripts/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          serverScriptsNode.children = [];
          serverScriptsNode.iconPath = this.getIconForType(serverScriptsNode.type);
          serverScriptsNode.scriptLanguage = "";
          serverScriptsNode.guid = "";
          serverScriptsNode.checkedOutBy = "";
          serverScriptsNode.filePath = "";
          serverScriptsNode.isSystem = false;

          data.push(serverScriptsNode as TreeEnterpriseItem);
        }

        // create server script category node
        var serverScriptCatNode: TreeEnterpriseItem | undefined = serverScriptsNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === parentName && item.type === EnterpriseItemType.ServerScriptCategory
        );

        if (!serverScriptCatNode) {
          serverScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ServerScriptCategory,
            parentName ?? "",
            "",
            `/ServerScripts/${parentName}/`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          serverScriptCatNode.children = [];
          serverScriptCatNode.iconPath = this.getIconForType(serverScriptCatNode.type);
          serverScriptCatNode.scriptLanguage = "";
          serverScriptCatNode.guid = "";
          serverScriptCatNode.checkedOutBy = "";
          serverScriptCatNode.filePath = "";
          serverScriptCatNode.isSystem = isSystem ? true : false;

          serverScriptsNode.children?.push(serverScriptCatNode as TreeEnterpriseItem);
        }

        // create server script node
        var serverScriptNode: TreeEnterpriseItem | undefined = serverScriptCatNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.ServerScript
        );

        if (!serverScriptNode) {
          let uri = `/ServerScripts/${parentName}/${childName}`;

          serverScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.ServerScript,
            childName ?? "",
            "SSL",
            uri,
            vscode.TreeItemCollapsibleState.None
          );

          serverScriptNode.guid = childId ?? "";
          serverScriptNode.checkedOutBy = checkedOutBy ?? "";
          serverScriptNode.isSystem = isSystem ? true : false;
          serverScriptNode.children = [];
          serverScriptNode.iconPath = this.getIconForType(serverScriptNode.type);
          serverScriptNode.filePath = "";
          serverScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

          serverScriptCatNode.children?.push(serverScriptNode as TreeEnterpriseItem);
          this.service.setCheckedOut(uri, checkedOutBy ?? "");
        }
      }

      if (parentType === "CSC") {
        // create "Client Scripts" root node
        var clientScriptsNode: TreeEnterpriseItem | undefined = data.find(
          (item: TreeEnterpriseItem) => item.label === "Client Scripts" && item.type === EnterpriseItemType.ClientScriptCategory
        );

        if (!clientScriptsNode) {
          clientScriptsNode = new TreeEnterpriseItem(
            EnterpriseItemType.ClientScriptCategory,
            "Client Scripts",
            "",
            "/ClientScripts/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          clientScriptsNode.children = [];
          clientScriptsNode.iconPath = this.getIconForType(clientScriptsNode.type);
          clientScriptsNode.scriptLanguage = "";
          clientScriptsNode.guid = "";
          clientScriptsNode.checkedOutBy = "";
          clientScriptsNode.filePath = "";
          clientScriptsNode.isSystem = false;

          data.push(clientScriptsNode as TreeEnterpriseItem);
        }

        // create client script category node
        var clientScriptCatNode: TreeEnterpriseItem | undefined = clientScriptsNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === parentName && item.type === EnterpriseItemType.ClientScriptCategory
        );

        if (!clientScriptCatNode) {
          clientScriptCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.ClientScriptCategory,
            parentName ?? "",
            "",
            `/ClientScripts/${parentName}/`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          clientScriptCatNode.children = [];
          clientScriptCatNode.iconPath = this.getIconForType(clientScriptCatNode.type);
          clientScriptCatNode.scriptLanguage = "";
          clientScriptCatNode.guid = "";
          clientScriptCatNode.checkedOutBy = "";
          clientScriptCatNode.filePath = "";
          clientScriptCatNode.isSystem = isSystem ? true : false;

          clientScriptsNode.children?.push(clientScriptCatNode as TreeEnterpriseItem);
        }

        // create client script node
        var clientScriptNode: TreeEnterpriseItem | undefined = clientScriptCatNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.ClientScript
        );

        if (!clientScriptNode) {
          let uri = `/ClientScripts/${parentName}/${childName}`;

          clientScriptNode = new TreeEnterpriseItem(
            EnterpriseItemType.ClientScript,
            childName ?? "",
            "JS",
            uri,
            vscode.TreeItemCollapsibleState.None
          );

          clientScriptNode.guid = childId ?? "";
          clientScriptNode.checkedOutBy = checkedOutBy ?? "";
          clientScriptNode.isSystem = isSystem ? true : false;
          clientScriptNode.children = [];
          clientScriptNode.iconPath = this.getIconForType(clientScriptNode.type);
          clientScriptNode.filePath = "";
          clientScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

          clientScriptCatNode.children?.push(clientScriptNode as TreeEnterpriseItem);
          this.service.setCheckedOut(uri, checkedOutBy ?? "");
        }
      }

      if (parentType === "DSC") {
        // create "Data Sources" category node
        var dataSourcesNode: TreeEnterpriseItem | undefined = data.find(
          (item: TreeEnterpriseItem) => item.label === "Data Sources" && item.type === EnterpriseItemType.DataSourceCategory
        );

        if (!dataSourcesNode) {
          dataSourcesNode = new TreeEnterpriseItem(
            EnterpriseItemType.DataSourceCategory,
            "Data Sources",
            "",
            "/DataSources/",
            vscode.TreeItemCollapsibleState.Expanded
          );

          dataSourcesNode.children = [];
          dataSourcesNode.iconPath = this.getIconForType(dataSourcesNode.type);
          dataSourcesNode.scriptLanguage = "";
          dataSourcesNode.guid = "";
          dataSourcesNode.checkedOutBy = "";
          dataSourcesNode.filePath = "";
          dataSourcesNode.isSystem = isSystem ? true : false;;

          data.push(dataSourcesNode as TreeEnterpriseItem);
        }

        // create data source category node
        var dataSourceCatNode: TreeEnterpriseItem | undefined = dataSourcesNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === parentName && item.type === EnterpriseItemType.DataSourceCategory
        );

        if (!dataSourceCatNode) {
          dataSourceCatNode = new TreeEnterpriseItem(
            EnterpriseItemType.DataSourceCategory,
            parentName ?? "",
            "",
            `/DataSources/${parentName}/`,
            vscode.TreeItemCollapsibleState.Expanded
          );

          dataSourceCatNode.children = [];
          dataSourceCatNode.iconPath = this.getIconForType(dataSourceCatNode.type);
          dataSourceCatNode.scriptLanguage = "";
          dataSourceCatNode.guid = "";
          dataSourceCatNode.checkedOutBy = "";
          dataSourceCatNode.filePath = "";
          dataSourceCatNode.isSystem = isSystem ? true : false;

          dataSourcesNode.children?.push(dataSourceCatNode as TreeEnterpriseItem);
        }

        // create data source node
        var dataSourceNode: TreeEnterpriseItem | undefined = dataSourceCatNode.children?.find(
          (item: TreeEnterpriseItem) => item.label === childName && item.type === EnterpriseItemType.DataSource
        );

        if (!dataSourceNode) {
          let uri = `/DataSources/${parentName}/${childName}`;

          dataSourceNode = new TreeEnterpriseItem(
            EnterpriseItemType.DataSource,
            childName ?? "",
            scriptLanguage === "SQL" ? "SLSQL" : "SSL",
            uri,
            vscode.TreeItemCollapsibleState.None
          );

          dataSourceNode.guid = childId ?? "";
          dataSourceNode.checkedOutBy = checkedOutBy ?? "";
          dataSourceNode.isSystem = isSystem ? true : false;
          dataSourceNode.children = [];
          dataSourceNode.iconPath = this.getIconForType(dataSourceNode.type);
          dataSourceNode.filePath = "";
          dataSourceNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

          dataSourceCatNode.children?.push(dataSourceNode as TreeEnterpriseItem);
          this.service.setCheckedOut(uri, checkedOutBy ?? "");
        }
      }
    }
    return data as TreeEnterpriseItem[];
  }
}
