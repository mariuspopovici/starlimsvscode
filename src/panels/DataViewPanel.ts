import * as vscode from "vscode";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";

export class DataViewPanel {
  public static currentPanel: DataViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _data: string;
  private _name: string;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    payload: any
  ) {
    this._panel = panel;
    this._data = payload.data;
    this._name = payload.name.slice("starlims:".length);

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri
    );

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);
  }

  public static render(extensionUri: vscode.Uri, payload: any) {
    if (DataViewPanel.currentPanel) {
      DataViewPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      DataViewPanel.currentPanel._name = payload.name.slice("starlims:".length);
      DataViewPanel.currentPanel._data = payload.data;
    } else {
      const panel = vscode.window.createWebviewPanel(
        "data-source-results",
        "Data Source Results",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
        }
      );

      DataViewPanel.currentPanel = new DataViewPanel(
        panel,
        extensionUri,
        payload
      );
    }
  }

  public dispose() {
    DataViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where *references* to CSS and JavaScript files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ) {
    const nonce = getNonce();
    const webviewUri = getUri(webview, extensionUri, ["dist", "webview.js"]);
    const styleUri = getUri(webview, extensionUri, ["dist", "style.css"]);

    // TIP: Install the es6-string-html VS Code extension to enable code highlighting below
    const html = /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" href="${styleUri}">
          <title>Data Source Results</title>
        </head>
        <body>
          <h1 id="title"></h1>
          <section>
            <vscode-data-grid id="data-source-grid" generate-header="sticky" aria-label="Data Source Results"></vscode-data-grid>
          </section>
          
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
      </html>
    `;

    return html;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        const data = message.data;
        switch (command) {
          case "requestDataSourceResultsData":
            // the webview controller (main.ts) sends a requestDataSourceResultsData message after initializing
            // we send it the data using a receiveDataSourceResultsData message
            webview.postMessage({
              command: "receiveDataSourceResultData",
              payload: this._data,
              name: this._name,
            });
            break;
        }
      },
      undefined,
      this._disposables
    );
  }
}