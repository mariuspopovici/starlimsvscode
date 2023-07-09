import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
  DataGrid,
} from "@vscode/webview-ui-toolkit";

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
//
// To register more toolkit components, simply import the component
// registration function and call it from within the register
// function, like so:
//
// provideVSCodeDesignSystem().register(
//   vsCodeButton(),
//   vsCodeCheckbox()
// );
//
// Finally, if you would like to register all of the toolkit
// components at once, there's a handy convenience function:
//
// provideVSCodeDesignSystem().register(allComponents);
//
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow()
);

// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

// Main function that gets executed once the webview DOM loads
function main() {
  // To get improved type annotations/IntelliSense the associated class for
  // a given toolkit component can be imported and used to type cast a reference
  // to the element (i.e. the `as Button` syntax)
  setVSCodeMessageListener();
  vscode.postMessage({ command: "requestDataSourceResultsData" });
}

function setVSCodeMessageListener() {
  window.addEventListener("message", (event) => {
    const command = event.data.command;
    const data = JSON.parse(event.data.payload);

    switch (command) {
      case "receiveDataSourceResultData":
        const grid = document.getElementById("data-source-grid") as DataGrid;
        const title = document.getElementById("title") as HTMLElement;
        title.innerHTML = event.data.name;

        if (grid) {
          const [columns, ...rows] = data;
          grid.rowsData = rows.map((row: any[]) => {
            const rowObject = {};
            columns.forEach((col: string, colIndex: number) => {
              Object.defineProperty(rowObject, col, {
                value: row[colIndex] === null ? "NULL" : row[colIndex],
              });
            });
            //TODO: replace 150px below with max-content when this is fixed: https://github.com/microsoft/vscode-webview-ui-toolkit/issues/473
            grid.setAttribute(
              "grid-template-columns",
              columns.map(() => `150px`).join(` `)
            );
            return rowObject;
          });

          debugger;
        }
        break;
    }
  });
}
