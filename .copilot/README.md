# STARLIMS VS Code Extension - Copilot Information

## Project Overview

This is a **Visual Studio Code extension** that provides comprehensive integration with **STARLIMS Enterprise Designer**. STARLIMS is a laboratory information management system (LIMS), and this extension enables developers to work with STARLIMS code directly from VS Code.

### Key Purpose
- Bridge between VS Code and STARLIMS Enterprise Designer
- Enable local development workflow for STARLIMS code items
- Provide syntax highlighting and IntelliSense for STARLIMS languages
- Support debugging and form design capabilities

## Project Type & Technology Stack

- **Language**: TypeScript
- **Platform**: VS Code Extension
- **Build Tool**: Webpack
- **Package Manager**: npm
- **Testing**: Mocha (configured but minimal tests)
- **Linting**: ESLint with TypeScript rules

## Core Architecture

### Main Components

1. **Extension Entry Point** (`src/extension.ts`)
   - Activation/deactivation logic
   - Command registration and configuration
   - Service initialization

2. **Services** (`src/services/`)
   - `EnterpriseService`: Core API communication with STARLIMS
   - `ExpressServer`: Local web server for form debugging

3. **Providers** (`src/providers/`)
   - `EnterpriseTreeDataProvider`: VS Code tree view for STARLIMS items
   - `CheckedOutTreeDataProvider`: Manages checked-out items
   - `EnterpriseTextDocumentContentProvider`: Virtual documents for remote content
   - `EnterpriseFileDecorationProvider`: File decorations for checkout status

4. **UI Panels** (`src/panels/`)
   - `ResourcesDataViewPanel`: Form resource management
   - `GenericDataViewPanel`: Generic data display

5. **Backend Integration** (`src/backend/`)
   - STARLIMS server-side package (.sdp file)
   - API endpoints for communication

### STARLIMS Languages Support

- **SSL** (STARLIMS Scripting Language): Server scripts and client scripts
- **SLSQL** (STARLIMS SQL): Data sources and database queries

## Key Features

### Source Control Integration
- Check out/in STARLIMS code items
- Compare local vs remote versions
- Undo checkout operations
- View checked-out items across users

### Development Tools
- Syntax highlighting for SSL/SLSQL
- Code snippets and IntelliSense
- Execute scripts and data sources remotely
- View execution results and logs

### Form Development
- Open HTML/XFD forms in browser
- Debug forms directly in VS Code
- Form designer (alpha version)
- Resource management for forms

### Database Integration
- Explore STARLIMS database tables
- Generate SQL statements (SELECT, INSERT, UPDATE, DELETE)
- View table definitions
- Navigate table relationships

## Configuration

The extension requires several settings:
- `STARLIMS.url`: STARLIMS server URL
- `STARLIMS.user`: Username for authentication
- `STARLIMS.rootPath`: Local folder for downloaded files
- `STARLIMS.browser`: Browser for form debugging (Chrome/Edge)

## Development Workflow

### Build Process
```bash
npm install          # Install dependencies
npm run lint        # Lint TypeScript code
npm run compile     # Compile with Webpack
npm run package     # Create production build
```

### File Organization
- Extension code is in TypeScript under `src/`
- Backend STARLIMS package under `src/backend/`
- Language definitions in root (syntax highlighting, snippets)
- VS Code configuration in `.vscode/`

## Common Development Tasks

### Adding New Commands
1. Define command in `package.json` under `contributes.commands`
2. Register command handler in `src/extension.ts`
3. Add menu items in `package.json` under `contributes.menus`

### Adding Language Features
1. Modify grammar files in `syntaxes/`
2. Update language configuration files
3. Add snippets in `snippets/`

### API Integration
1. Extend `EnterpriseService` for new STARLIMS API calls
2. Update tree providers for new item types
3. Add corresponding UI commands and handlers

## Important Files

- `package.json`: Extension manifest and VS Code contribution points
- `src/extension.ts`: Main extension entry point
- `src/services/enterpriseService.ts`: Core STARLIMS API integration
- `webpack.config.js`: Build configuration
- `syntaxes/*.json`: Language grammar definitions

## Dependencies

### Key Runtime Dependencies
- `@vscode/webview-ui-toolkit`: UI components for webviews
- `node-fetch`: HTTP requests to STARLIMS APIs
- `@xmldom/xmldom`: XML processing for STARLIMS data
- `express`: Local server for form debugging

### Development Dependencies
- TypeScript compiler and ESLint for code quality
- Webpack for bundling
- VS Code extension testing framework

## Notes for AI Assistants

- This is a specialized extension for STARLIMS developers
- Focuses on enterprise laboratory management workflows
- Requires understanding of both VS Code extension development and STARLIMS platform
- SSL and SLSQL are proprietary languages specific to STARLIMS
- The extension acts as a bridge between local development environment and remote STARLIMS server