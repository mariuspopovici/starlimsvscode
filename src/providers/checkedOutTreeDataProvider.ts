"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { EnterpriseItemType, TreeEnterpriseItem } from "./enterpriseTreeDataProvider";
import { DOMParser } from "xmldom";
import { EnterpriseService } from "../services/enterpriseService";

/**
 * Implements the VS Code TreeDataProvider to build the STARLIMS Checked out tree.
 */
export class CheckedOutTreeDataProvider implements vscode.TreeDataProvider<TreeEnterpriseItem> {
    private data: TreeEnterpriseItem[] = [];
    private _onDidChangeTreeData: vscode.EventEmitter<TreeEnterpriseItem | null> = new vscode.EventEmitter<TreeEnterpriseItem | null>();
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
            (item.children?.length ?? 0) > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );
        treeItem.iconPath = item.iconPath;
        treeItem.contextValue = item.type;
        treeItem.label = item.checkedOutBy ? `${item.label} (Checked out by ${item.checkedOutBy})` : item.label;
        treeItem.resourceUri = this.getItemResource(item);
        treeItem.tooltip = item.tooltip ?? item.label?.toString() ?? "";
        treeItem.command = {
            command: "STARLIMS.selectEnterpriseItem",
            title: "Open Item",
            arguments: [item]
        };
        return treeItem;
    }

    getChildren(item?: TreeEnterpriseItem): Thenable<TreeEnterpriseItem[] | undefined> {
        return item && Promise.resolve(item.children ?? [])
            || Promise.resolve(this.data);
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

        // If the item is checked out by the current user, change the icon color to green.
        if (item.checkedOutBy && item.checkedOutBy === config.get("user")) {
            resourceUri = vscode.Uri.parse("checkedOutByMe");
            item.color = new vscode.ThemeColor("gitDecoration.modifiedResourceForeground");
        }
        // If the item is checked out by another user, change the icon color to red.
        else if (item.checkedOutBy) {
            resourceUri = vscode.Uri.parse("checkedOutByOtherUser");
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
                var rootNode: TreeEnterpriseItem | undefined =
                    data.find((item: TreeEnterpriseItem) => item.label === "Applications");

                if (!rootNode) {
                    rootNode = new TreeEnterpriseItem(
                        EnterpriseItemType.EnterpriseCategory,
                        "Applications",
                        "",
                        "/Applications/",
                        vscode.TreeItemCollapsibleState.Expanded);

                    rootNode.children = [];
                    rootNode.iconPath = this.getIconForType(EnterpriseItemType.EnterpriseCategory);
                    rootNode.language = "";
                    rootNode.guid = "";
                    rootNode.checkedOutBy = "";
                    rootNode.filePath = "";
                    rootNode.isSystem = false;

                    data.push(rootNode as TreeEnterpriseItem);
                };

                // create application category node
                var appCatNode: TreeEnterpriseItem | undefined =
                    rootNode?.children?.find((item: TreeEnterpriseItem) => item.label === appCatName);

                if (!appCatNode) {
                    appCatNode = new TreeEnterpriseItem(
                        EnterpriseItemType.AppCategory,
                        appCatName ?? "",
                        "",
                        `/Applications/${appCatName}/`,
                        vscode.TreeItemCollapsibleState.Expanded);

                    appCatNode.children = [];
                    appCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                    appCatNode.language = "";
                    appCatNode.guid = "";
                    appCatNode.checkedOutBy = "";
                    appCatNode.filePath = "";
                    appCatNode.isSystem = isSystem ? true : false;

                    rootNode?.children?.push(appCatNode as TreeEnterpriseItem);
                }

                // create application node
                var appNode: TreeEnterpriseItem | undefined =
                    appCatNode.children?.find((item: TreeEnterpriseItem) => item.label === parentName);

                if (!appNode) {
                    appNode = new TreeEnterpriseItem(
                        EnterpriseItemType.Application,
                        parentName ?? "",
                        "",
                        `/Applications/${appCatName}/${parentName}/`,
                        vscode.TreeItemCollapsibleState.Expanded);

                    appNode.children = [];
                    appNode.iconPath = this.getIconForType(EnterpriseItemType.Application);
                    appNode.language = "";
                    appNode.guid = parentID ?? "";
                    appNode.checkedOutBy = "";
                    appNode.filePath = "";
                    appNode.isSystem = isSystem ? true : false;

                    appCatNode.children?.push(appNode as TreeEnterpriseItem);
                }

                if (scriptLanguage === "HTML") {
                    // create "HTML Forms" node
                    var htmlFormsCatNode: TreeEnterpriseItem | undefined =
                        appNode.children?.find((item: TreeEnterpriseItem) => item.label === "HTML Forms");

                    if (!htmlFormsCatNode) {
                        htmlFormsCatNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppCategory,
                            "HTML Forms",
                            "",
                            `/Applications/${appCatName}/${parentName}/HTMLForms`,
                            vscode.TreeItemCollapsibleState.Expanded);

                        htmlFormsCatNode.children = [];
                        htmlFormsCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                        htmlFormsCatNode.language = "";
                        htmlFormsCatNode.guid = "";
                        htmlFormsCatNode.checkedOutBy = "";
                        htmlFormsCatNode.filePath = "";
                        htmlFormsCatNode.isSystem = false;

                        appNode.children?.push(htmlFormsCatNode as TreeEnterpriseItem);
                    }

                    // create HTML form XML node
                    var htmlFormXmlNode: TreeEnterpriseItem | undefined =
                        htmlFormsCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
                    {
                        htmlFormXmlNode = new TreeEnterpriseItem(
                            EnterpriseItemType.HTMLFormCode,
                            childName + " [XML]" ?? "",
                            "XML",
                            `/Applications/${appCatName}/${parentName}/HTMLForms/XML/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        htmlFormXmlNode.guid = childId ?? "";
                        htmlFormXmlNode.checkedOutBy = checkedOutBy ?? "";
                        htmlFormXmlNode.isSystem = isSystem ? true : false;
                        htmlFormXmlNode.children = [];
                        htmlFormXmlNode.iconPath = this.getIconForType(EnterpriseItemType.HTMLFormCode);
                        htmlFormXmlNode.filePath = "";
                        htmlFormXmlNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        htmlFormsCatNode.children?.push(htmlFormXmlNode);
                    }

                    // create HTML form code behind node
                    var htmlFormCodeNode: TreeEnterpriseItem | undefined =
                        htmlFormsCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
                    {
                        htmlFormCodeNode = new TreeEnterpriseItem(
                            EnterpriseItemType.HTMLFormCode,
                            childName + " [Code Behind]" ?? "",
                            "JS",
                            `/Applications/{appCatName}/${parentName}/HTMLForms/CodeBehind/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        htmlFormCodeNode.guid = childId ?? "";
                        htmlFormCodeNode.checkedOutBy = checkedOutBy ?? "";
                        htmlFormCodeNode.isSystem = isSystem ? true : false;
                        htmlFormCodeNode.children = [];
                        htmlFormCodeNode.iconPath = this.getIconForType(EnterpriseItemType.HTMLFormCode);
                        htmlFormCodeNode.filePath = "";
                        htmlFormCodeNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        htmlFormsCatNode.children?.push(htmlFormCodeNode);
                    }

                    // create HTML form guide node
                    var htmlFormCodeNode: TreeEnterpriseItem | undefined =
                        htmlFormsCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);
                    {
                        htmlFormCodeNode = new TreeEnterpriseItem(
                            EnterpriseItemType.HTMLFormCode,
                            childName + " [Guide]" ?? "",
                            "GUIDE",
                            `/Applications/${appCatName}/${parentName}/HTMLForms/Guide/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        htmlFormCodeNode.guid = childId ?? "";
                        htmlFormCodeNode.checkedOutBy = checkedOutBy ?? "";
                        htmlFormCodeNode.isSystem = isSystem ? true : false;
                        htmlFormCodeNode.children = [];
                        htmlFormCodeNode.iconPath = this.getIconForType(EnterpriseItemType.HTMLFormCode);
                        htmlFormCodeNode.filePath = "";
                        htmlFormCodeNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        htmlFormsCatNode.children?.push(htmlFormCodeNode);
                    }
                }
                else if (scriptLanguage === "JSCRIPT") {
                    // create "XFD Forms" node
                    var xfdFormsCatNode: TreeEnterpriseItem | undefined =
                        appNode.children?.find((item: TreeEnterpriseItem) => item.label === "XFD Forms");

                    if (!xfdFormsCatNode) {
                        xfdFormsCatNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppCategory,
                            "XFD Forms",
                            "",
                            `/Applications/${appCatName}/${parentName}/XFDForms`,
                            vscode.TreeItemCollapsibleState.Expanded);

                        xfdFormsCatNode.children = [];
                        xfdFormsCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                        xfdFormsCatNode.language = "";
                        xfdFormsCatNode.guid = "";
                        xfdFormsCatNode.checkedOutBy = "";
                        xfdFormsCatNode.filePath = "";
                        xfdFormsCatNode.isSystem = false;

                        appNode.children?.push(xfdFormsCatNode as TreeEnterpriseItem);
                    }

                    // create XFD form XML node
                    var xfdFormXmlNode: TreeEnterpriseItem | undefined =
                        xfdFormsCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                    if (!xfdFormXmlNode) {
                        xfdFormXmlNode = new TreeEnterpriseItem(
                            EnterpriseItemType.XFDFormCode,
                            childName ?? "",
                            "XML",
                            `/Applications/${appCatName}/${parentName}/XFDForms/XML/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        xfdFormXmlNode.guid = childId ?? "";
                        xfdFormXmlNode.checkedOutBy = checkedOutBy ?? "";
                        xfdFormXmlNode.isSystem = isSystem ? true : false;
                        xfdFormXmlNode.children = [];
                        xfdFormXmlNode.iconPath = this.getIconForType(EnterpriseItemType.XFDFormCode);
                        xfdFormXmlNode.filePath = "";
                        xfdFormXmlNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        xfdFormsCatNode.children?.push(xfdFormXmlNode as TreeEnterpriseItem);
                    }

                    // create XFD form code behind node
                    var xfdFormCodeNode: TreeEnterpriseItem | undefined =
                        xfdFormsCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                    if (!xfdFormCodeNode) {
                        xfdFormCodeNode = new TreeEnterpriseItem(
                            EnterpriseItemType.XFDFormCode,
                            childName ?? "",
                            "JS",
                            `/Applications/${appCatName}/${parentName}/XFDForms/CodeBehind/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        xfdFormCodeNode.guid = childId ?? "";
                        xfdFormCodeNode.checkedOutBy = checkedOutBy ?? "";
                        xfdFormCodeNode.isSystem = isSystem ? true : false;
                        xfdFormCodeNode.children = [];
                        xfdFormCodeNode.iconPath = this.getIconForType(EnterpriseItemType.XFDFormCode);
                        xfdFormCodeNode.filePath = "";
                        xfdFormCodeNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        xfdFormsCatNode.children?.push(xfdFormCodeNode as TreeEnterpriseItem);
                    }

                }

                if (childType === "AppServerScript") {
                    // create "Server Scripts" node
                    var appServerScriptsNode: TreeEnterpriseItem | undefined =
                        appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Server Scripts");

                    if (!appServerScriptsNode) {
                        appServerScriptsNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppCategory,
                            "Server Scripts",
                            "",
                            `/Applications/${appCatName}/${parentName}/ServerScripts`,
                            vscode.TreeItemCollapsibleState.Expanded);

                        appServerScriptsNode.children = [];
                        appServerScriptsNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                        appServerScriptsNode.language = "";
                        appServerScriptsNode.guid = "";
                        appServerScriptsNode.checkedOutBy = "";
                        appServerScriptsNode.filePath = "";
                        appServerScriptsNode.isSystem = false;

                        appNode.children?.push(appServerScriptsNode as TreeEnterpriseItem);
                    }

                    // create server script node
                    var appServerScriptNode: TreeEnterpriseItem | undefined =
                        appServerScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                    if (!appServerScriptNode) {
                        appServerScriptNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppServerScript,
                            childName ?? "",
                            "SSL",
                            `/Applications/${appCatName}/${parentName}/ServerScripts/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        appServerScriptNode.guid = childId ?? "";
                        appServerScriptNode.checkedOutBy = checkedOutBy ?? "";
                        appServerScriptNode.isSystem = isSystem ? true : false;
                        appServerScriptNode.children = [];
                        appServerScriptNode.iconPath = this.getIconForType(EnterpriseItemType.AppServerScript);
                        appServerScriptNode.filePath = "";
                        appServerScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        appServerScriptsNode.children?.push(appServerScriptNode as TreeEnterpriseItem);
                    }
                }

                if (childType === "AppClientScript") {
                    // create "Client Scripts" node
                    var appClientScriptsNode: TreeEnterpriseItem | undefined =
                        appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Client Scripts");

                    if (!appClientScriptsNode) {
                        appClientScriptsNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppCategory,
                            "Client Scripts",
                            "",
                            `/Applications/${appCatName}/${parentName}/ClientScripts`,
                            vscode.TreeItemCollapsibleState.Expanded);

                        appClientScriptsNode.children = [];
                        appClientScriptsNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                        appClientScriptsNode.language = "";
                        appClientScriptsNode.guid = "";
                        appClientScriptsNode.checkedOutBy = "";
                        appClientScriptsNode.filePath = "";
                        appClientScriptsNode.isSystem = false;

                        appNode.children?.push(appClientScriptsNode as TreeEnterpriseItem);
                    }

                    // create client script node
                    var appClientScriptNode: TreeEnterpriseItem | undefined =
                        appClientScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                    if (!appClientScriptNode) {
                        appClientScriptNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppClientScript,
                            childName ?? "",
                            "JS",
                            `/Applications/${appCatName}/${parentName}/ClientScripts/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        appClientScriptNode.guid = childId ?? "";
                        appClientScriptNode.checkedOutBy = checkedOutBy ?? "";
                        appClientScriptNode.isSystem = isSystem ? true : false;
                        appClientScriptNode.children = [];
                        appClientScriptNode.iconPath = this.getIconForType(EnterpriseItemType.AppClientScript);
                        appClientScriptNode.filePath = "";
                        appClientScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        appClientScriptsNode.children?.push(appClientScriptNode as TreeEnterpriseItem);
                    }
                }

                if (childType === "AppDataSource") {
                    // create "Data Sources" node
                    var appDataSourcesNode: TreeEnterpriseItem | undefined =
                        appNode.children?.find((item: TreeEnterpriseItem) => item.label === "Data Sources");

                    if (!appDataSourcesNode) {
                        appDataSourcesNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppCategory,
                            "Data Sources",
                            "",
                            `/Applications/${appCatName}/${parentName}/DataSources`,
                            vscode.TreeItemCollapsibleState.Expanded);

                        appDataSourcesNode.children = [];
                        appDataSourcesNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                        appDataSourcesNode.language = "";
                        appDataSourcesNode.guid = "";
                        appDataSourcesNode.checkedOutBy = "";
                        appDataSourcesNode.filePath = "";
                        appDataSourcesNode.isSystem = false;

                        appNode.children?.push(appDataSourcesNode as TreeEnterpriseItem);
                    }

                    // create data source node
                    var appDataSourceNode: TreeEnterpriseItem | undefined =
                        appDataSourcesNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                    if (!appDataSourceNode) {
                        appDataSourceNode = new TreeEnterpriseItem(
                            EnterpriseItemType.AppDataSource,
                            childName ?? "",
                            scriptLanguage === "SQL" ? "SLSQL" : "SSL",
                            `/Applications/${appCatName}/${parentName}/DataSources/${childName}`,
                            vscode.TreeItemCollapsibleState.None);

                        appDataSourceNode.guid = childId ?? "";
                        appDataSourceNode.checkedOutBy = checkedOutBy ?? "";
                        appDataSourceNode.isSystem = isSystem ? true : false;
                        appDataSourceNode.children = [];
                        appDataSourceNode.iconPath = this.getIconForType(EnterpriseItemType.AppDataSource);
                        appDataSourceNode.filePath = "";
                        appDataSourceNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                        appDataSourcesNode.children?.push(appDataSourceNode as TreeEnterpriseItem);
                    }
                }
            }

            if (parentType === "SSC") {
                // create "Server Scripts" root node
                var serverScriptsNode: TreeEnterpriseItem | undefined =
                    data.find((item: TreeEnterpriseItem) => item.label === "Server Scripts");

                if (!serverScriptsNode) {
                    serverScriptsNode = new TreeEnterpriseItem(
                        EnterpriseItemType.EnterpriseCategory,
                        "Server Scripts",
                        "",
                        "/ServerScripts/",
                        vscode.TreeItemCollapsibleState.Expanded);

                    serverScriptsNode.children = [];
                    serverScriptsNode.iconPath = this.getIconForType(EnterpriseItemType.EnterpriseCategory);
                    serverScriptsNode.language = "";
                    serverScriptsNode.guid = "";
                    serverScriptsNode.checkedOutBy = "";
                    serverScriptsNode.filePath = "";
                    serverScriptsNode.isSystem = false;

                    data.push(serverScriptsNode as TreeEnterpriseItem);
                }

                // create server script category node
                var serverScriptCatNode: TreeEnterpriseItem | undefined =
                    serverScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === parentName);

                if (!serverScriptCatNode) {
                    serverScriptCatNode = new TreeEnterpriseItem(
                        EnterpriseItemType.AppCategory,
                        parentName ?? "",
                        "",
                        `/ServerScripts/${parentName}/`,
                        vscode.TreeItemCollapsibleState.Expanded);

                    serverScriptCatNode.children = [];
                    serverScriptCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                    serverScriptCatNode.language = "";
                    serverScriptCatNode.guid = "";
                    serverScriptCatNode.checkedOutBy = "";
                    serverScriptCatNode.filePath = "";
                    serverScriptCatNode.isSystem = isSystem ? true : false;

                    serverScriptsNode.children?.push(serverScriptCatNode as TreeEnterpriseItem);
                }

                // create server script node
                var serverScriptNode: TreeEnterpriseItem | undefined =
                    serverScriptCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                if (!serverScriptNode) {
                    serverScriptNode = new TreeEnterpriseItem(
                        EnterpriseItemType.ServerScript,
                        childName ?? "",
                        "SSL",
                        `/ServerScripts/${parentName}/${childName}`,
                        vscode.TreeItemCollapsibleState.None);

                    serverScriptNode.guid = childId ?? "";
                    serverScriptNode.checkedOutBy = checkedOutBy ?? "";
                    serverScriptNode.isSystem = isSystem ? true : false;
                    serverScriptNode.children = [];
                    serverScriptNode.iconPath = this.getIconForType(EnterpriseItemType.ServerScript);
                    serverScriptNode.filePath = "";
                    serverScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                    serverScriptCatNode.children?.push(serverScriptNode as TreeEnterpriseItem);
                }
            }

            if (parentType === "CSC") {
                // create "Client Scripts" root node
                var clientScriptsNode: TreeEnterpriseItem | undefined =
                    data.find((item: TreeEnterpriseItem) => item.label === "Client Scripts");

                if (!clientScriptsNode) {
                    clientScriptsNode = new TreeEnterpriseItem(
                        EnterpriseItemType.EnterpriseCategory,
                        "Client Scripts",
                        "",
                        "/ClientScripts/",
                        vscode.TreeItemCollapsibleState.Expanded);

                    clientScriptsNode.children = [];
                    clientScriptsNode.iconPath = this.getIconForType(EnterpriseItemType.EnterpriseCategory);
                    clientScriptsNode.language = "";
                    clientScriptsNode.guid = "";
                    clientScriptsNode.checkedOutBy = "";
                    clientScriptsNode.filePath = "";
                    clientScriptsNode.isSystem = false;

                    data.push(clientScriptsNode as TreeEnterpriseItem);
                }

                // create client script category node
                var clientScriptCatNode: TreeEnterpriseItem | undefined =
                    clientScriptsNode.children?.find((item: TreeEnterpriseItem) => item.label === parentName);

                if (!clientScriptCatNode) {
                    clientScriptCatNode = new TreeEnterpriseItem(
                        EnterpriseItemType.AppCategory,
                        parentName ?? "",
                        "",
                        `/ClientScripts/${parentName}/`,
                        vscode.TreeItemCollapsibleState.Expanded);

                    clientScriptCatNode.children = [];
                    clientScriptCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                    clientScriptCatNode.language = "";
                    clientScriptCatNode.guid = "";
                    clientScriptCatNode.checkedOutBy = "";
                    clientScriptCatNode.filePath = "";
                    clientScriptCatNode.isSystem = isSystem ? true : false;
                        
                    clientScriptsNode.children?.push(clientScriptCatNode as TreeEnterpriseItem);
                }

                // create client script node
                var clientScriptNode: TreeEnterpriseItem | undefined =
                    clientScriptCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                if (!clientScriptNode) {
                    clientScriptNode = new TreeEnterpriseItem(
                        EnterpriseItemType.ServerScript,
                        childName ?? "",
                        "JS",
                        `/ClientScripts/${parentName}/${childName}`,
                        vscode.TreeItemCollapsibleState.None);

                    clientScriptNode.guid = childId ?? "";
                    clientScriptNode.checkedOutBy = checkedOutBy ?? "";
                    clientScriptNode.isSystem = isSystem ? true : false;
                    clientScriptNode.children = [];
                    clientScriptNode.iconPath = this.getIconForType(EnterpriseItemType.ServerScript);
                    clientScriptNode.filePath = "";
                    clientScriptNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                    clientScriptCatNode.children?.push(clientScriptNode as TreeEnterpriseItem);
                }
            }

            if (parentType === "DSC") {
                // create "Data Sources" category node
                var dataSourcesNode: TreeEnterpriseItem | undefined =
                    data.find((item: TreeEnterpriseItem) => item.label === "Data Sources");

                if (!dataSourcesNode) {
                    dataSourcesNode = {
                        label: "Data Sources",
                        type: EnterpriseItemType.EnterpriseCategory,
                        children: [],
                        iconPath: this.getIconForType(EnterpriseItemType.EnterpriseCategory),
                        language: "",
                        uri: "/DataSources/",
                        guid: "",
                        checkedOutBy: "",
                        filePath: ""
                    };
                    data.push(dataSourcesNode as TreeEnterpriseItem);
                }

                // create data source category node
                var dataSourceCatNode: TreeEnterpriseItem | undefined =
                    dataSourcesNode.children?.find((item: TreeEnterpriseItem) => item.label === parentName);

                if (!dataSourceCatNode) {
                    dataSourceCatNode = new TreeEnterpriseItem(
                        EnterpriseItemType.AppCategory,
                        parentName ?? "",
                        "",
                        `/DataSources/${parentName}/`,
                        vscode.TreeItemCollapsibleState.Expanded);

                    dataSourceCatNode.children = [];
                    dataSourceCatNode.iconPath = this.getIconForType(EnterpriseItemType.AppCategory);
                    dataSourceCatNode.language = "";
                    dataSourceCatNode.guid = "";
                    dataSourceCatNode.checkedOutBy = "";
                    dataSourceCatNode.filePath = "";
                    dataSourceCatNode.isSystem = isSystem ? true : false;

                    dataSourcesNode.children?.push(dataSourceCatNode as TreeEnterpriseItem);
                }

                // create data source node
                var dataSourceNode: TreeEnterpriseItem | undefined =
                    dataSourceCatNode.children?.find((item: TreeEnterpriseItem) => item.label === childName);

                if (!dataSourceNode) {
                    dataSourceNode = new TreeEnterpriseItem(
                        EnterpriseItemType.DataSource,
                        childName ?? "",
                        scriptLanguage === "SQL" ? "SLSQL" : "SSL",
                        `/DataSources/${parentName}/${childName}`,
                        vscode.TreeItemCollapsibleState.None);

                    dataSourceNode.guid = childId ?? "";
                    dataSourceNode.checkedOutBy = checkedOutBy ?? "";
                    dataSourceNode.isSystem = isSystem ? true : false;
                    dataSourceNode.children = [];
                    dataSourceNode.iconPath = this.getIconForType(EnterpriseItemType.DataSource);
                    dataSourceNode.filePath = "";
                    dataSourceNode.tooltip = `Checked out by ${checkedOutBy} on ${checkedOutDate}`;

                    dataSourceCatNode.children?.push(dataSourceNode as TreeEnterpriseItem);
                }
            }
        }
        return data as TreeEnterpriseItem[];
    }
}
