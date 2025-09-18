"use strict";
import * as vscode from "vscode";

export interface ServerConfig {
  name: string;
  url: string;
  user?: string;
  urlSuffix?: string;
}

export class ServerSelectorWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'STARLIMSServerSelector';

  private _view?: vscode.WebviewView;
  private _servers: ServerConfig[] = [];
  private _selectedServer: string = '';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _onServerChanged: (server: ServerConfig | undefined) => void
  ) {
    this.loadServers();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'serverSelected':
          this.selectServer(data.serverName);
          break;
        case 'configureServer':
          this.configureCurrentServer();
          break;
        case 'ready':
          this.updateWebview();
          break;
      }
    });
  }

  private loadServers() {
    const config = vscode.workspace.getConfiguration("STARLIMS");
    this._servers = config.get("servers", []);
    this._selectedServer = config.get("selectedServer", "");

    // Migrate legacy configuration if needed
    const legacyUrl = config.get("url") as string;
    const legacyUser = config.get("user") as string;
    
    if (legacyUrl && this._servers.length === 0) {
      const legacyServer: ServerConfig = {
        name: "Default Server",
        url: legacyUrl,
        user: legacyUser,
        urlSuffix: config.get("urlSuffix", "lims")
      };
      this._servers = [legacyServer];
      this._selectedServer = legacyServer.name;
      
      // Save migrated configuration
      config.update("servers", this._servers, false);
      config.update("selectedServer", this._selectedServer, false);
    }
  }

  private selectServer(serverName: string) {
    this._selectedServer = serverName;
    const config = vscode.workspace.getConfiguration("STARLIMS");
    config.update("selectedServer", serverName, false);
    
    const selectedServerConfig = this._servers.find(s => s.name === serverName);
    this._onServerChanged(selectedServerConfig);
    this.updateWebview();
  }

  private async configureCurrentServer() {
    const selectedServerConfig = this._servers.find(s => s.name === this._selectedServer);
    
    if (!selectedServerConfig) {
      // Create new server
      await this.createNewServer();
    } else {
      // Edit existing server
      await this.editServer(selectedServerConfig);
    }
  }

  private async createNewServer() {
    const name = await vscode.window.showInputBox({
      prompt: "Enter server name",
      placeHolder: "My STARLIMS Server"
    });
    
    if (!name) return;

    const url = await vscode.window.showInputBox({
      prompt: "Enter STARLIMS URL",
      placeHolder: "https://my.starlims.server.com/STARLIMS/"
    });
    
    if (!url) return;

    const user = await vscode.window.showInputBox({
      prompt: "Enter username (optional)",
      placeHolder: "username"
    });

    const urlSuffix = await vscode.window.showInputBox({
      prompt: "Enter URL suffix (optional)",
      placeHolder: "lims",
      value: "lims"
    });

    const newServer: ServerConfig = {
      name,
      url,
      user: user || undefined,
      urlSuffix: urlSuffix || "lims"
    };

    this._servers.push(newServer);
    const config = vscode.workspace.getConfiguration("STARLIMS");
    await config.update("servers", this._servers, false);
    
    if (this._servers.length === 1) {
      this._selectedServer = newServer.name;
      await config.update("selectedServer", this._selectedServer, false);
      this._onServerChanged(newServer);
    }
    
    this.updateWebview();
  }

  private async editServer(server: ServerConfig) {
    const url = await vscode.window.showInputBox({
      prompt: "Enter STARLIMS URL",
      value: server.url
    });
    
    if (url === undefined) return;

    const user = await vscode.window.showInputBox({
      prompt: "Enter username",
      value: server.user || ""
    });

    if (user === undefined) return;

    const urlSuffix = await vscode.window.showInputBox({
      prompt: "Enter URL suffix",
      value: server.urlSuffix || "lims"
    });

    if (urlSuffix === undefined) return;

    // Update server config
    server.url = url;
    server.user = user || undefined;
    server.urlSuffix = urlSuffix || "lims";

    const config = vscode.workspace.getConfiguration("STARLIMS");
    await config.update("servers", this._servers, false);
    
    if (this._selectedServer === server.name) {
      this._onServerChanged(server);
    }
    
    this.updateWebview();
  }

  public refreshServers() {
    this.loadServers();
    this.updateWebview();
  }

  public getSelectedServer(): ServerConfig | undefined {
    return this._servers.find(s => s.name === this._selectedServer);
  }

  private updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateServers',
        servers: this._servers,
        selectedServer: this._selectedServer
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Selector</title>
        <style>
            body {
                padding: 10px;
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
            }
            .server-selector {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
            }
            select {
                flex: 1;
                padding: 4px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-size: var(--vscode-font-size);
            }
            button {
                padding: 4px 8px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: var(--vscode-font-size);
                white-space: nowrap;
            }
            button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .no-servers {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="server-selector">
            <select id="serverSelect">
                <option value="">No servers configured</option>
            </select>
            <button id="configureBtn" title="Configure Server">⚙️</button>
        </div>
        <div id="noServers" class="no-servers" style="display: none;">
            No servers configured. Click the configure button to add a server.
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const serverSelect = document.getElementById('serverSelect');
            const configureBtn = document.getElementById('configureBtn');
            const noServers = document.getElementById('noServers');

            serverSelect.addEventListener('change', () => {
                vscode.postMessage({
                    type: 'serverSelected',
                    serverName: serverSelect.value
                });
            });

            configureBtn.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'configureServer'
                });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'updateServers':
                        updateServerList(message.servers, message.selectedServer);
                        break;
                }
            });

            function updateServerList(servers, selectedServer) {
                serverSelect.innerHTML = '';
                
                if (servers.length === 0) {
                    serverSelect.innerHTML = '<option value="">No servers configured</option>';
                    noServers.style.display = 'block';
                    serverSelect.disabled = true;
                } else {
                    noServers.style.display = 'none';
                    serverSelect.disabled = false;
                    
                    servers.forEach(server => {
                        const option = document.createElement('option');
                        option.value = server.name;
                        option.textContent = server.name;
                        if (server.name === selectedServer) {
                            option.selected = true;
                        }
                        serverSelect.appendChild(option);
                    });
                }
            }

            // Initialize
            vscode.postMessage({ type: 'ready' });
        </script>
    </body>
    </html>`;
  }
}