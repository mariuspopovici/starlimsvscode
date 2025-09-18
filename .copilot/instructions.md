# Development Instructions

## Getting Started

### Prerequisites
- Node.js 14+ and npm
- VS Code for testing the extension
- Access to a STARLIMS server for integration testing

### Setup
```bash
# Clone and install dependencies
git clone https://github.com/MrDoe/starlimsvscode.git
cd starlimsvscode
npm install

# Build the extension
npm run compile

# Run linting
npm run lint
```

### Testing the Extension
1. Open the project in VS Code
2. Press F5 to launch Extension Development Host
3. Test extension functionality in the new window

## Code Standards & Conventions

### TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use async/await for promises
- Follow existing naming conventions (camelCase for variables, PascalCase for classes)

### File Organization
```
src/
├── extension.ts           # Main entry point
├── services/             # Business logic and API integration
├── providers/            # VS Code providers (tree views, content, etc.)
├── panels/              # Webview panels and UI
├── utilities/           # Helper functions and utilities
└── backend/             # STARLIMS server-side components
```

### Error Handling
- Always wrap STARLIMS API calls in try-catch blocks
- Use `vscode.window.showErrorMessage()` for user-facing errors
- Log detailed errors to the output channel for debugging
- Validate user inputs before making API calls

## Working with STARLIMS APIs

### Authentication
- Use `EnterpriseService` for all STARLIMS communication
- Store credentials securely using VS Code's SecretStorage
- Handle authentication failures gracefully

### API Patterns
```typescript
// Example API call pattern
try {
  const result = await this.enterpriseService.someApiCall(params);
  // Handle success
} catch (error) {
  this.outputChannel.appendLine(`Error: ${error.message}`);
  vscode.window.showErrorMessage('Operation failed');
}
```

### Data Models
- STARLIMS items have consistent structure: category, name, type
- Use TypeScript interfaces for API response types
- Handle both XML and JSON responses from STARLIMS

## UI Development

### Tree Views
- Extend `vscode.TreeDataProvider` for new tree views
- Use context values for menu item visibility
- Implement refresh functionality for data updates

### Webview Panels
- Use `@vscode/webview-ui-toolkit` for consistent UI
- Handle message passing between extension and webview
- Dispose resources properly to prevent memory leaks

### Commands and Menus
1. Add command to `package.json` contributions
2. Register handler in `extension.ts`
3. Add to appropriate menus (context, view/title, etc.)

## Language Support

### Adding New Language Features
1. **Grammar Files** (`syntaxes/`): Define syntax highlighting rules
2. **Language Configuration**: Set up brackets, comments, indentation
3. **Snippets** (`snippets/`): Add code templates

### SSL/SLSQL Specifics
- SSL is case-insensitive but preserve user casing
- SLSQL follows SQL conventions with STARLIMS extensions
- Support both traditional and modern STARLIMS syntax

## Common Development Patterns

### Configuration Management
```typescript
const config = vscode.workspace.getConfiguration('STARLIMS');
const url = config.get<string>('url');
```

### Progress Indication
```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Processing...'
}, async (progress) => {
  // Long-running operation
});
```

### File Operations
- Use `vscode.workspace.fs` for file system operations
- Handle both local and virtual file URIs
- Respect workspace trust settings

## Testing Guidelines

### Manual Testing Checklist
- [ ] Extension activation/deactivation
- [ ] STARLIMS connection and authentication
- [ ] Tree view loading and refresh
- [ ] Check out/in operations
- [ ] Script execution and results
- [ ] Form debugging in browser
- [ ] Configuration changes

### Integration Testing
- Test against different STARLIMS versions
- Verify SSL/SLSQL language support
- Test error scenarios (network issues, authentication failures)

## Debugging Tips

### Extension Development
- Use VS Code debugger with F5 launch
- Check Developer Tools console in Extension Development Host
- Monitor output channels for detailed logs

### STARLIMS Integration
- Use browser dev tools for API request inspection
- Check STARLIMS server logs for backend issues
- Verify web.config HTTPServices setting

### Common Issues
1. **Authentication failures**: Check credentials and server connectivity
2. **Tree view not loading**: Verify API endpoints and permissions
3. **Syntax highlighting issues**: Check grammar file syntax and file associations

## Performance Considerations

### API Optimization
- Cache frequently accessed data (tree structure, item lists)
- Use pagination for large datasets
- Implement lazy loading for tree views

### Memory Management
- Dispose event listeners and providers on deactivation
- Clean up temporary files and webview panels
- Monitor extension memory usage during development

## Release Process

### Version Management
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Update CHANGELOG.md with release notes
- Update package.json version

### Building for Release
```bash
npm run package        # Create production build
npm run build         # Create VSIX package
```

### Testing Before Release
- Test on clean VS Code installation
- Verify all features work without development dependencies
- Test against target STARLIMS versions

## Troubleshooting

### Build Issues
- Clear node_modules and reinstall if webpack fails
- Check TypeScript compilation errors
- Verify all dependencies are compatible

### Runtime Issues
- Check VS Code Developer Tools console
- Review extension output channel logs
- Test with minimal configuration

### STARLIMS Connectivity
- Verify server URL and HTTPServices configuration
- Test API endpoints manually with curl/Postman
- Check firewall and network connectivity