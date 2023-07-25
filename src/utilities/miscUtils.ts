import * as vscode from "vscode";

/**
 * Removes the last / and the starhtml.lims suffics from the specified STARLIMS system URL.
 * @param url the URL to clean up.
 */
export function cleanUrl(url: string) {
  let newUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  if (newUrl.endsWith(".lims")) {
    newUrl = newUrl.slice(0, newUrl.lastIndexOf("/"));
  }
  return newUrl;
}

/**
 * Wraps a long running task specified by ```fn```` with a progress bar info message displayed in the VS Code
 * status bar.
 *
 * @param fn an async function which executes a long running task
 * @param progressMessage the message to display in the VS Code progress indicator
 */
export function executeWithProgress(fn: Function, progressMessage: string) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      cancellable: false,
      title: "STARLIMS"
    },
    async (progress) => {
      progress.report({ increment: 0, message: progressMessage });
      await fn();
      progress.report({ increment: 100, message: "Done." });
    }
  );
}
