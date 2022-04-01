/* eslint-disable @typescript-eslint/naming-convention */
import fetch from "node-fetch";
import { Headers } from "node-fetch";
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";

export class EnterpriseService {
  private config: any;
  private baseUrl: string;

  constructor(config: any) {
    this.config = config;
    this.baseUrl = this.cleanUrl(config.url);
  }

  public async getEnterpriseItem(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.GetEnterpriseItems.lims?${params}`;
    const headers = this.getAPIAuthHeaders();
    const options: any = {
      method: "GET",
      headers,
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } =
        await response.json();
      if (success) {
        return data.items;
      } else {
        vscode.window.showErrorMessage("Could not retrieve enterprise items.");
        console.log(data);
        return [];
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve enterprise items.");
      return [];
    }
  }

  public async getEntepriseItemCode(uri: string) {
    const params = new URLSearchParams([["URI", uri]]);
    const url = `${this.baseUrl}/SCM_API.GetCode.lims?${params}`;
    const headers = this.getAPIAuthHeaders();
    const options: any = {
      method: "GET",
      headers,
    };

    try {
      const response = await fetch(url, options);
      const { success, data }: { success: boolean; data: any } =
        await response.json();
      if (success) {
        return data;
      } else {
        vscode.window.showErrorMessage("Could not retrieve item code.");
        console.log(data);
        return null;
      }
    } catch (e: any) {
      console.error(e);
      vscode.window.showErrorMessage("Could not retrieve item code.");
      return null;
    }
  }

  public async checkin(uri: string, reason: string) {
    vscode.window.showErrorMessage("Not implemented. Coming soon...");
  }

  public async checkout(uri: string) {
    vscode.window.showErrorMessage("Not implemented. Coming soon...");
  }

  private getAPIAuthHeaders(): Headers {
    return new Headers([
      ["STARLIMSUser", this.config.user],
      ["STARLIMSPass", this.config.password],
    ]);
  }

  public async getLocalCopy(uri: string, workspaceFolder: string) {
    const item = await this.getEntepriseItemCode(uri);
    if (item) {
      const localFilePath = path.join(
        workspaceFolder,
        `${uri}.${item.Language.toLowerCase()}`
      );

      try {
        const localFolder = path.dirname(localFilePath);
        await fs.mkdir(localFolder, { recursive: true });

        let writeFile = true;
        try {
          await fs.stat(localFilePath);
          let answer = await vscode.window.showInformationMessage(
            "A local copy already exists. Would you local to overwrite it with the remote version?",
            "Yes",
            "No"
          );
          writeFile = answer === "Yes";
        } catch {
          // ignore - file does not exist
        }

        if (writeFile) {
          await fs.writeFile(localFilePath, item.Code, {
            encoding: "utf8",
          });
          vscode.window.showInformationMessage(
            `Code downloaded locally to ${localFilePath}`
          );
          return localFilePath;
        }
      } catch (e) {
        vscode.window.showErrorMessage(`Cannot write file ${localFilePath}.`);
        console.error(e);
      }
    }

    return null;
  }

  private cleanUrl(url: string) {
    let newUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    if (newUrl.endsWith(".lims")) {
      newUrl = newUrl.slice(0, newUrl.lastIndexOf("/"));
    }

    return newUrl;
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
