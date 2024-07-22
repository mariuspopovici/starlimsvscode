import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import * as vscode from 'vscode';

dotenv.config();

export class ExpressServer
{
    private app: Express;
    private port: number;

    constructor()
    {
        this.app = express();
        this.port = 3000;
    }

    public start()
    {
        this.app.get('/', (req: Request, res: Response) => {
            res.send('Starlims VS Code HTTP Server');
        });

        this.app.listen(this.port, () => {
            vscode.window.showInformationMessage(
                `Starlims VS Code HTTP Server running on http://localhost:${this.port}`
            );
        });

        /**
         * Open the code behind file for the form id
         * @param FormId The form id to open
         * @returns OK if successful, error message if failed
         */
        this.app.get('/OpenCodeBehind/:formId/:functionName', async (req: Request, res: Response) => {
            const formId = req.params.formId;
            const functionName = req.params.functionName;
            try {
              vscode.commands.executeCommand("STARLIMS.OpenCodeBehind", formId, functionName);
              res.send(`OK for form id ${formId}`);
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to open form id ${formId}: ${error}`);
              res.send(`Failed to open form id ${formId}: ${error}`);
            }
          });
    }
}
