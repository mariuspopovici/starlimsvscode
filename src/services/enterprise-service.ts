/* eslint-disable @typescript-eslint/naming-convention */
import fetch from "node-fetch";
import { Headers } from "node-fetch";
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";
import { Enterprise } from "./enterprise";

/**
 * STARLIMS Enterprise Designer service. Provides main services for the VS Code extensions,
 * at time using the SCM_API REST services in STARLIMS backed.
 */
export class EnterpriseService implements Enterprise {
  private config: any;
  private baseUrl: string;

  /**
   * Constructor.
   *
   * @param config Workspace config object for the STARLIMS VS Code extension.
   */
  constructor(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this.baseUrl = this.cleanUrl(config.url);
  }

  /**
   * Gets a descriptor of the STARLIMS Enterprise code item referenced by the specified URI.
   *
   * @param uri the URI of the remote STARLIMS code item.
   * @returns A descriptor object with the following properties: Name, Type, URI, Language, IsFolder
   */
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

  /**
   * Gets the code and code language (XML, JS, SSL, SQL etc.) of the STARLIMS Enterprise Designer referenced
   * by the specified URI.
   *
   * @param uri the URI of the remote STARLIMS script / code item.
   * @returns an object with Language: string and Code: string
   */
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

  /**
   * Downloads the specified STARLIMS enterprise designer item to a local workspace folder.
   *
   * @param uri the URI to the remote script / code item
   * @param workspaceFolder the local workspace folder where to download the file
   * @returns the local path to the downloaded file
   */
  public async getLocalCopy(
    uri: string,
    workspaceFolder: string
  ): Promise<string | null> {
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

  private getAPIAuthHeaders(): Headers {
    return new Headers([
      ["STARLIMSUser", this.config.user],
      ["STARLIMSPass", this.config.password],
    ]);
  }

  /**
   * Cleans up the configured app URL by removing unnecessary things suchs as extra / characters.
   *
   * @param url the STARLIMS app URL
   * @returns the base URL for REST API calls
   */
  private cleanUrl(url: string) {
    let newUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    if (newUrl.endsWith(".lims")) {
      newUrl = newUrl.slice(0, newUrl.lastIndexOf("/"));
    }

    return newUrl;
  }
}
