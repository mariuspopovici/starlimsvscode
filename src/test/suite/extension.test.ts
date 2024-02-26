import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { escapeXml } from '../../panels/ResourcesDataViewPanel';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	// unit test for escape xml special symbols in string
	test('ResourcesDataViewPanel.escapeXml', () => {
		assert.strictEqual(escapeXml("\""), "&quot;")
		assert.strictEqual(escapeXml("'"), "&apos;")
		assert.strictEqual(escapeXml("&"), "&amp;")
		assert.strictEqual(escapeXml(">"), "&gt;")
		assert.strictEqual(escapeXml("<"), "&lt;")

		// test multiple occurances
		assert.strictEqual(escapeXml("&value& & "), "&amp;value&amp; &amp; ")
		assert.strictEqual(escapeXml("<value>"), "&lt;value&gt;")
		assert.strictEqual(escapeXml("\"quoted string\""), "&quot;quoted string&quot;")

		const notEscapedString = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ +=!@#$%^*()?:{}|`\n\t\v"
		assert.strictEqual(escapeXml(notEscapedString), notEscapedString)

		assert.strictEqual(escapeXml(''), '') // empty string
	})

});
