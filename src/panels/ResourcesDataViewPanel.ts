import * as vscode from "vscode";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";
import { EnterpriseService } from "../services/enterpriseService";
import { EnterpriseTreeDataProvider } from "../providers/enterpriseTreeDataProvider";

export class ResourcesDataViewPanel {
  public static currentPanel: ResourcesDataViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private data: string;
  private name: string;
  private title: string;
  private docPath: string;
  private enterpriseService: EnterpriseService;
  private enterpriseTree: EnterpriseTreeDataProvider;
  private uri: string;
  private extensionUri: vscode.Uri;
  private language: string = "ENG";

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    payload: any,
    enterpriseService: EnterpriseService,
    enterpriseTree: EnterpriseTreeDataProvider
  ) {
    this._panel = panel;
    this.data = payload.data;
    this.name = payload.name;
    this.title = payload.title;
    this.docPath = payload.docPath;
    this.enterpriseService = enterpriseService;
    this.enterpriseTree = enterpriseTree;
    this.uri = payload.uri;
    this.language = payload.language;
    this.extensionUri = extensionUri;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, enterpriseService);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);
  }

  // render the webview panel
  public static render(
    extensionUri: vscode.Uri,
    payload: any,
    enterpriseService: EnterpriseService,
    enterpriseTree: EnterpriseTreeDataProvider
  ) {
    const panel = vscode.window.createWebviewPanel("data-results", payload.title, vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")]
    });

    ResourcesDataViewPanel.currentPanel = new ResourcesDataViewPanel(
      panel,
      extensionUri,
      payload,
      enterpriseService,
      enterpriseTree
    );
  }

  // dispose the webview panel
  public dispose() {
    ResourcesDataViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
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
  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, enterpriseService: EnterpriseService) {
    const nonce = getNonce();
    const webviewUri = getUri(webview, extensionUri, ["dist", "webview.js"]);
    const styleUri = getUri(webview, extensionUri, ["dist", "style.css"]);
    const codiconUri = getUri(webview, extensionUri, ["dist", "codicon.css"]);

    // insert language options before the webview is rendered, because vscode-dropdown doesn't support a
    // direct manipulation of its options in the same way as a regular HTML select element
    let languageOptions = "";
    for (const language of enterpriseService.languages) {
      // set the selected attribute if the language matches the current language
      if (language[0] === this.language) {
        languageOptions += `<vscode-option value="${language[0]}" selected>${language[1]}</vscode-option>\n`;
      } else {
        languageOptions += `<vscode-option value="${language[0]}">${language[1]}</vscode-option>\n`;
      }
    }

    // TIP: Install the es6-string-html VS Code extension to enable code highlighting below
    const html = /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" href="${styleUri}">
          <link rel="stylesheet" href="${codiconUri}">
          <title>${this.title}</title>
        </head>
        <body>
          <input type="hidden" id="docPath" value="${this.docPath}" />
          <h1 id="title">${this.title}</h1>
          <div class="dropdown-wrapper">
            <label class="dropdown-label">Language:</label>
            <vscode-dropdown position="below" id="language-dropdown">
              ${languageOptions}
            </vscode-dropdown>
            <vscode-button id="save-button" appearance="primary">Save Changes</vscode-button>
          </div>
          <vscode-data-grid id="data-grid" aria-label="Data Grid"></vscode-data-grid>
          <div class="footer">
            <vscode-button id="add-button" appearance="secondary">Add Row</vscode-button>
          </div>
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
      </html>
    `;
    return html;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is received.
   *
   * @param webview A reference to the extension webview
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        switch (command) {
          case "requestData":
            // the webview controller (main.ts) sends a requestData message after initializing
            // send the data to the grid using a receiveData message
            webview.postMessage({
              command: "receiveData",
              payload: this.data
            });
            break;

          case "saveResourcesData":
            // coming from webview controller after clicking the save button
            // save the grid data to the file system

            // get payload containing columns and data
            let jsonData = message.payload;

            // get row data as array
            const jsonDataObj = JSON.parse(jsonData);
            const data = jsonDataObj.data;

            // convert to XML
            let xmlData =
              '<?xml version="1.0" encoding="UTF-8"?>\n' +
              '<ResourcesDataset xmlns="http://tempuri.org/ResourcesDataset.xsd">\n';

            for (const row of data) {
              xmlData +=
                "\t<ResourcesTable>\n" +
                `\t\t<Guid>${row[0]}</Guid>\n` +
                `\t\t<ResourceId>${this.escapeXml(row[1])}</ResourceId>\n` +
                `\t\t<ResourceValue>${this.escapeXml(row[2])}</ResourceValue>\n` +
                "\t</ResourcesTable>\n";
            }
            xmlData += "</ResourcesDataset>";

            // save the file locally
            const fs = require("fs");
            fs.writeFile(this.docPath, xmlData, (err: any) => {
              if (err) {
                console.error(err);
                return;
              }
            });

            // save the item
            this.enterpriseService.saveEnterpriseItemCode(this.uri, xmlData, this.language);
            break;

          case "changeLanguage":
            // coming from webview controller after changing the language dropdown
            let lastLanguage = this.language;
            this.language = message.payload;

            // check out and re-check in the form under the current language
            var formUri = this.uri.replace("/Resources", "/XML");
            this.enterpriseService.checkInItem(formUri, "Edit form resources", lastLanguage).then((data: any) => {
              this.enterpriseService.checkOutItem(formUri, this.language).then((data: any) => {
                // reload the enterprise tree & checked out tree
                this.enterpriseTree.refresh();

                // refresh checked out items
                vscode.commands.executeCommand("STARLIMS.GetCheckedOutItems");

                // reload the webview with the new language
                this.enterpriseService.getFormResources(this.uri, this.language).then((data: any) => {
                  ResourcesDataViewPanel.render(this.extensionUri, data, this.enterpriseService, this.enterpriseTree);
                });
              });
            });
            break;

          case "saveTableData":
            // coming from webview controller after clicking the save button
            // save the grid data to the file system
            vscode.window.showErrorMessage("Saving table data is not yet implemented.");
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  /*
   * escape xml tag text special symbol
   */
  private escapeXml(unsafe: string) {
    var result
    result = unsafe.replace("<", "&lt;")
    result = unsafe.replace(">", "&gt;")
    result = unsafe.replace("&", "&amp;")
    result = unsafe.replace("\'", "&apos;")
    result = unsafe.replace("\"", "&quot;")
    return result
  }
}
