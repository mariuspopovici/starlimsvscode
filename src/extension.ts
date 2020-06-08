'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { EnterpriseTreeDataProvider, TreeEnterpriseItem } from './enterpriseProvider';
import { EnterpriseService } from './services/enterpriseService';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {    
    
    let config = vscode.workspace.getConfiguration("STARLIMS");
    let user: string | undefined = config.get('user');

    if (!user) {
        user = await vscode.window.showInputBox({
            prompt: 'Enter STARLIMS user name',
            ignoreFocusOut: true,
        });
    }
    process.env['STARLIMS_USER'] = user;

    let password = await vscode.window.showInputBox({
        prompt: `Enter password for STARLIMS user '${user}'`,
        password: true,
        ignoreFocusOut: true
    });

    if (password) {
        process.env['STARLIMS_PASSWORD'] = password;
    }

    const enterpriseService = new EnterpriseService(config);
    const enterpriseProvider = new EnterpriseTreeDataProvider(enterpriseService);
    
    vscode.window.registerTreeDataProvider('STARLIMS', enterpriseProvider);
    vscode.commands.registerCommand('STARLIMS.selectEnterpriseItem', async (item: TreeEnterpriseItem) => {
    
        // open only leaf nodes
        if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            return;
        }
        
        let result = await enterpriseService.getEntepriseItemCode(item.type, item.enterpriseId);
        if (result) {
            // open code in new document
            const fileExtension = '.' + (result.Language !== undefined && result.Language !== '' ? result.Language.toLowerCase() : 'txt');
            
            const newFile = vscode.Uri.parse('untitled:' + path.join(vscode.workspace.rootPath ? vscode.workspace.rootPath : '', result.FullPath + fileExtension));
            
            let document = await vscode.workspace.openTextDocument(newFile);
            const edit = new vscode.WorkspaceEdit();
            edit.insert(newFile, new vscode.Position(0, 0), result.Code);
            
            if (await vscode.workspace.applyEdit(edit)) {
                vscode.window.showTextDocument(document);
            } else {
                vscode.window.showInformationMessage('Error!');
            }
        }
    });

    vscode.commands.registerCommand('STARLIMS.downloadApp', async (node) => {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: 'Select Folder'
        };

        const result = await vscode.window.showOpenDialog(options);
        if (result ) {
            const path = result[0].path;
            const appManifest = await enterpriseService.getApplicationManifest(node.enterpriseId);
            console.log(path);
            console.log(appManifest);
            await enterpriseService.downloadApplication(appManifest, path);
        }
    });

    vscode.commands.registerCommand('STARLIMS.Checkout', async (item: TreeEnterpriseItem) => {
        await enterpriseService.checkout(item.type, item.enterpriseId);
    });

    vscode.commands.registerCommand('STARLIMS.Checkin', async (item: TreeEnterpriseItem) => {
        let checkinReason : string = await vscode.window.showInputBox( {
            prompt: 'Enter checkin reason',
            ignoreFocusOut: true,
        })||'';
       
        await enterpriseService.checkin(item.type, item.enterpriseId, checkinReason);
    });

    vscode.commands.registerCommand('STARLIMS.refresh', async (item: TreeEnterpriseItem) => {
        await enterpriseProvider.refresh();
    });

    vscode.commands.registerCommand('STARLIMS.save', async (item: vscode.TreeItem) => {
        let activeEditor : any = vscode.window.activeTextEditor;
        if(activeEditor !== undefined) {
            let sFileName : any = activeEditor.document.fileName;
            let sCode : any = activeEditor.document.getText();
            sFileName = path.basename(sFileName);
            sFileName = sFileName.substr(0, sFileName.lastIndexOf('.'));
            await enterpriseService.save(sFileName, sCode);
        }
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}