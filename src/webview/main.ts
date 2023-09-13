import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
  vsCodeDropdown,
  vsCodeOption,
  DataGrid,
  DataGridCell,
  Dropdown,
  Button
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

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow(),
  vsCodeDropdown(),
  vsCodeOption()
);

// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components
window.addEventListener("load", main);

// Main function that gets executed once the webview DOM loads
function main() {
  // set message listener
  setVSCodeMessageListener();

  // request data
  vscode.postMessage({ command: "requestData" });

  // add add button click event
  const addButton = document.getElementById("add-button") as Button;
  addButton.addEventListener("click", () => {
    const grid = document.getElementById("data-grid") as DataGrid;
    if (grid.columnDefinitions === null || grid.rowsData === null) {
      return;
    }

    // add a new row to the grid
    const newRow: any = {};

    // generate new guid
    const guid = () => {
      const s4 = () =>
        Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
    };

    // add guid to first column
    newRow["column0"] = guid();

    // add empty strings to the rest of the columns
    for (let i = 1; i < grid.columnDefinitions.length; i++) {
      newRow[`column${i}`] = "";
    }

    grid.rowsData.push(newRow);
  });

  // add save button click event
  const saveButton = document.getElementById("save-button") as Button;
  saveButton.addEventListener("click", () => {
    saveData();
  });

  // add language dropdown change event
  const languageDropdown = document.getElementById("language-dropdown") as Dropdown;
  languageDropdown.addEventListener("change", () => {
    // send the selected language to the extension context
    vscode.postMessage({ command: "changeLanguage", payload: languageDropdown.value });
  });

  // make the data grid editable
  initEditableDataGrid("data-grid");
}

/**
 * Sets up an event listener to listen for messages passed from the VS Code context and
 * executes code based on the message that is received.
 */
function setVSCodeMessageListener() {
  window.addEventListener("message", (event) => {
    const command = event.data.command;
    let data = JSON.parse(event.data.payload);

    // handle messages from the extension context
    switch (command) {
      case "receiveData":
        // load fresh data in the data grid
        const grid = document.getElementById("data-grid") as DataGrid;

        if (grid) {
          // extract column definitions from the data
          const columns = data[0];
          // exclude the first row from the data
          data = data.slice(1);

          // Set column definitions based on extracted column names
          grid.columnDefinitions = columns.map((columnName: any, index: any) => ({
            columnDataKey: `column${index}`,
            title: columnName
          }));

          // Set rowsData based on extracted data
          grid.rowsData = data.map((rowData: string[]) => {
            const row: any = {};
            rowData.forEach((value, index) => {
              row[`column${index}`] = value?.toString().trim();
            });
            return row;
          });

          // set grid column widths for large number of columns otherwise the output is unintelligible
          // TODO: replace 150px below with max-content when this is fixed: https://github.com/microsoft/vscode-webview-ui-toolkit/issues/473
          if (columns.length > 10) {
            grid.setAttribute("grid-template-columns", columns.map(() => `150px`).join(` `));
          }
        }
        break;
    }
  });
}

/**
 * Makes a given data grid editable
 * @param id The id of the data grid to make editable
 */
function initEditableDataGrid(id: string) {
  const grid = document.getElementById(id) as DataGridCell;
  grid?.addEventListener("cell-focused", (e: Event) => {
    const cell = e.target as DataGridCell;
    // Do not continue if `cell` is undefined/null or is not a grid cell
    if (!cell || cell.role !== "gridcell") {
      return;
    }
    // Do not allow data grid header cells to be editable
    if (cell.className === "column-header") {
      return;
    }

    // Note: Need named closures in order to later use removeEventListener
    // in the handleBlurClosure function
    const handleKeydownClosure = (e: KeyboardEvent) => {
      handleKeydown(e, cell);
    };
    const handleClickClosure = () => {
      setCellEditable(cell);
    };
    const handleBlurClosure = () => {
      syncCellChanges(cell);
      unsetCellEditable(cell);
      // Remove the blur, keydown, and click event listener _only after_
      // the cell is no longer focused
      cell.removeEventListener("blur", handleBlurClosure);
      cell.removeEventListener("keydown", handleKeydownClosure);
      cell.removeEventListener("click", handleClickClosure);
    };

    cell.addEventListener("keydown", handleKeydownClosure);
    // Run the click listener once so that if a cell's text is clicked a
    // second time the cursor will move to the given position in the string
    // (versus reselecting the cell text again)
    cell.addEventListener("click", handleClickClosure, { once: true });
    cell.addEventListener("blur", handleBlurClosure);
  });
}

// Make a given cell editable
function setCellEditable(cell: DataGridCell) {
  // don't edit cells in the first column
  if (cell.columnDefinition?.columnDataKey === "column0") {
    return;
  }
  cell.setAttribute("contenteditable", "plaintext-only");
}

// Handle keyboard events on a given cell
function handleKeydown(e: KeyboardEvent, cell: DataGridCell) {
  if (!cell.hasAttribute("contenteditable") || cell.getAttribute("contenteditable") === "false") {
    if (e.key === "Enter") {
      e.preventDefault();
      setCellEditable(cell);
    }
  } else {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      syncCellChanges(cell);
      unsetCellEditable(cell);
    }
  }
}

// Make a given cell non-editable
function unsetCellEditable(cell: DataGridCell) {
  cell.setAttribute("contenteditable", "false");
}

// Syncs changes made in an editable cell with the
// underlying data structure of a vscode-data-grid
function syncCellChanges(cell: DataGridCell) {
  const column: any = cell.columnDefinition;
  const row: any = cell.rowData;
  if (column && row) {
    const originalValue = row[column.columnDataKey];
    const newValue = cell.innerText;

    if (originalValue !== newValue) {
      row[column.columnDataKey] = newValue.trim();
    }
  }
}

// Function to save data
function saveData() {
  const grid = document.getElementById("data-grid") as DataGrid;

  if (grid.columnDefinitions === null || grid.rowsData === null) {
    return;
  }

  interface GridData {
    columns: (string | undefined)[];
    data: any[];
  }
  let gridData: GridData = {
    columns: [],
    data: []
  };

  // Update the gridData object with the latest data
  gridData.columns = grid.columnDefinitions.map((columnDefinition) => columnDefinition.title);
  gridData.data = grid.rowsData.map((rowData: any) =>
    grid.columnDefinitions?.map((columnDefinition: any) => rowData[columnDefinition.columnDataKey])
  );

  // Send the gridData object to the extension context
  const title = (document.getElementById("title") as HTMLInputElement).innerText;
  if (title.includes("Resources")) {
    vscode.postMessage({ command: "saveResourcesData", payload: JSON.stringify(gridData) });
  } else if (title.includes("Table")) {
    vscode.postMessage({ command: "saveTableData", payload: JSON.stringify(gridData) });
  }
}
