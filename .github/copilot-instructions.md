# STARLIMS VS Code Extension - Copilot Instructions

## Repository Overview

This repository contains an unofficial VS Code extension that provides integration with STARLIMS Enterprise Designer, a Laboratory Information Management System. The extension enables developers to manage STARLIMS code items (scripts, forms, data sources) directly from VS Code with features like source control, debugging, and intellisense support.

### High Level Repository Information

- **Repository Type**: VS Code Extension (TypeScript-based)
- **Main Languages**: TypeScript (95%), JavaScript, CSS, JSON
- **Size**: ~1,800 TypeScript files, 25MB total
- **Target Runtime**: VS Code Extension Host (Node.js backend)
- **Key Frameworks**: 
  - VS Code Extension API
  - Express.js (local server)
  - Webpack (bundling)
  - Node-fetch (HTTP client)
  - React (webview components)
- **VS Code API Version**: ^1.86.0
- **Node.js Version**: Compatible with 16.x, 18.x, 22.x

## Build and Validation Instructions

### Prerequisites

- Node.js (16.x, 18.x, or 22.x) 
- npm (included with Node.js)
- VS Code (for testing the extension)

### Environment Setup

**ALWAYS run `npm install` before any build operations** - this is required to install dependencies including webpack, TypeScript compiler, and VS Code test utilities.

```bash
npm install
```

### Build Commands (In Order)

1. **Linting** (Always run first):
```bash
npm run lint
```
- Uses ESLint with TypeScript parser
- Checks code style and catches common errors
- Should complete in ~5-10 seconds with no errors

2. **Compilation** (Development build):
```bash
npm run compile
```
- Uses webpack to bundle extension and webview code
- Creates `dist/extension.js` and `dist/webview.js`
- Takes ~5-15 seconds
- **Note**: Warning about Express view.js dependency is expected and safe to ignore

3. **Packaging** (Production build):
```bash
npm run package
```
- Creates optimized production build with source maps
- Takes ~10-20 seconds
- Required before publishing or testing final version

4. **Testing** (Optional but recommended):
```bash
npm run compile-tests  # Compiles test files
npm run pretest        # Runs compile-tests, compile, and lint
# Note: Full test suite requires VS Code to be installed and may not work in headless environments
```

### Build Validation

After successful build, verify these files exist:
- `dist/extension.js` (main extension bundle)
- `dist/webview.js` (webview components)
- `dist/SCM_API.sdp` (STARLIMS backend package)
- `dist/style.css` (webview styles)

### Known Build Issues & Workarounds

- **Express dependency warning**: The warning about "Critical dependency: the request of a dependency is an expression" in Express is expected and does not affect functionality
- **Build timing**: On slower systems, increase timeout expectations - packaging can take up to 30 seconds
- **Test requirements**: Integration tests require VS Code installation and display environment

## Project Architecture & Layout

### Directory Structure

```
/
├── .github/workflows/          # CI/CD pipelines
│   ├── webpack.yml            # Build validation (Node 16.x, 18.x, 22.x)
│   └── publish.yml            # Automated publishing to VS Code Marketplace
├── src/                       # Main source code
│   ├── extension.ts           # Main extension entry point (1,825 lines)
│   ├── services/              # Core business logic
│   │   ├── enterpriseService.ts    # STARLIMS API integration (1,152 lines)
│   │   ├── iEnterpriseService.ts   # Service interface
│   │   └── expressServer.ts        # Local HTTP server for form debugging
│   ├── providers/             # VS Code provider implementations
│   │   ├── enterpriseTreeDataProvider.ts      # Main tree view
│   │   ├── checkedOutTreeDataProvider.ts      # Source control status
│   │   ├── enterpriseTextContentProvider.ts   # Virtual document provider
│   │   └── enterpriseFileDecorationProvider.ts # File decorations
│   ├── panels/                # Webview panel implementations
│   ├── utilities/             # Helper functions
│   ├── test/                  # Test suite
│   ├── webview/               # React-based webview components
│   ├── backend/               # STARLIMS backend scripts
│   │   ├── SCM_API/          # Server-side API scripts
│   │   └── create-packages.sh # Backend packaging script
│   └── client/eslint/         # ESLint configuration for STARLIMS code
├── syntaxes/                  # Language definitions
│   ├── ssl.tmLanguage.json    # STARLIMS Scripting Language syntax
│   └── slsql.tmLanguage.json  # STARLIMS SQL syntax
├── themes/                    # VS Code color themes
├── package.json               # Extension manifest and dependencies
├── webpack.config.js          # Build configuration
├── tsconfig.json             # TypeScript configuration
└── .eslintrc.json            # Code quality rules
```

### Key Configuration Files

- **package.json**: Extension manifest defining commands, settings, language support, and build scripts
- **webpack.config.js**: Dual-target build (extension + webview) with CSS and file copying
- **tsconfig.json**: TypeScript compiler targeting ES2020 with strict mode
- **.eslintrc.json**: Code quality rules using @typescript-eslint

### Architecture Components

1. **Extension Host** (`src/extension.ts`): Main activation point, command registration, and coordination
2. **Enterprise Service** (`src/services/enterpriseService.ts`): HTTP client for STARLIMS REST API
3. **Tree Providers**: Display STARLIMS items in VS Code tree views
4. **Text Content Provider**: Virtual documents for remote STARLIMS code
5. **Express Server**: Local debugging server for STARLIMS HTML forms
6. **Webview Panels**: React-based UI for complex data display
7. **Backend Scripts**: STARLIMS server-side API implementation (.sdp package)

### GitHub Workflows

The repository uses two automated workflows:

1. **webpack.yml** (Build Validation):
   - Triggered on: Push/PR to master branch
   - Tests: Node.js 16.x, 18.x, 22.x compatibility
   - Steps: npm install → npx webpack
   - Purpose: Ensure builds work across supported Node versions

2. **publish.yml** (Automated Publishing):
   - Triggered on: Push to master branch
   - Steps: Install dependencies → Bump version → Build VSIX → Publish to marketplace → Create GitHub release
   - Artifacts: VSIX package + SCM_API.sdp backend
   - **Important**: Uses secrets for marketplace token

### Extension Settings

The extension contributes these settings (configured via VS Code settings):
- `STARLIMS.url`: STARLIMS server URL
- `STARLIMS.user`: Authentication username  
- `STARLIMS.userPassword`: Password (stored securely, not in settings file)
- `STARLIMS.rootPath`: Local workspace path for downloaded files
- `STARLIMS.browser`: Debugging browser (chrome/msedge)
- `STARLIMS.urlSuffix`: API endpoint suffix (default: "lims")

### Language Support

The extension defines two custom languages:
- **SSL** (STARLIMS Scripting Language): `.ssl`, `.srvscr` files
- **SLSQL** (STARLIMS SQL): `.slsql` files

Both include syntax highlighting, code snippets, and ESLint integration.

### Key Dependencies

- **@vscode/test-electron**: VS Code testing framework
- **express**: Local debugging server
- **node-fetch**: HTTP client for STARLIMS API
- **@xmldom/xmldom**: XML parsing for STARLIMS forms
- **jsdom**: DOM manipulation for form processing
- **webpack + ts-loader**: Build pipeline
- **eslint + @typescript-eslint**: Code quality

### Development Workflow

For implementing changes:
1. **Always start with**: `npm install` if dependencies changed
2. **Development cycle**: `npm run lint` → `npm run compile` → test in VS Code
3. **Before commit**: `npm run package` to verify production build
4. **Testing**: Use VS Code Extension Development Host for manual testing

### Critical Implementation Notes

- Extension requires STARLIMS server with SCM_API backend package installed
- Local file structure follows pattern: `{rootPath}/SLVSCODE/{ItemType}/{Category}/{ItemName}`
- URI scheme: `starlims:///{ItemType}/{Category}/{ItemName}` for virtual documents
- Password storage uses VS Code SecretStorage API for security
- Auto-installs ESLint configuration to user workspace on first use

**When making changes, always trust these instructions first**. Only search for additional information if these instructions are incomplete or found to be incorrect. The build process is well-established and should work consistently across environments.