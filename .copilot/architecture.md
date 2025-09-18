# System Architecture

## High-Level Architecture

The STARLIMS VS Code extension follows a client-server architecture where VS Code acts as the client and STARLIMS server provides the backend services.

```
┌─────────────────┐    HTTP/API    ┌─────────────────┐
│   VS Code       │ ──────────────► │  STARLIMS       │
│   Extension     │                 │  Server         │
│                 │ ◄────────────── │                 │
└─────────────────┘                 └─────────────────┘
        │                                   │
        │ File System                       │ Database
        │                                   │
        ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│   Local         │                 │  STARLIMS       │
│   Workspace     │                 │  Database       │
└─────────────────┘                 └─────────────────┘
```

## Core Components

### 1. Extension Host (`src/extension.ts`)

**Responsibilities:**
- Extension lifecycle management (activate/deactivate)
- Command registration and routing
- Configuration management
- Service initialization and dependency injection

**Key Methods:**
- `activate()`: Initialize services, providers, and commands
- `deactivate()`: Clean up resources

### 2. Enterprise Service (`src/services/enterpriseService.ts`)

**Purpose:** Central API communication layer with STARLIMS server

**Key Responsibilities:**
- HTTP request management to STARLIMS APIs
- Authentication handling
- Data serialization/deserialization
- Error handling and retry logic

**API Endpoints:**
- `/SCM_API/EnterpriseGet`: Retrieve item metadata
- `/SCM_API/EnterpriseGetFiles`: Download item content
- `/SCM_API/EnterpriseCheckout`: Check out items
- `/SCM_API/EnterpriseCheckin`: Check in changes
- `/SCM_API/EnterpriseExecute`: Execute scripts/data sources

### 3. Tree Data Providers

#### Enterprise Tree Provider (`src/providers/enterpriseTreeDataProvider.ts`)
- Displays STARLIMS item hierarchy
- Implements lazy loading for performance
- Handles item type categorization (Applications, Server Scripts, etc.)

#### Checked Out Tree Provider (`src/providers/checkedOutTreeDataProvider.ts`)
- Shows items currently checked out by user
- Supports operations like check-in, undo checkout
- Real-time status updates

### 4. Content Providers

#### Text Document Content Provider (`src/providers/enterpriseTextContentProvider.ts`)
- Provides virtual documents for remote STARLIMS content
- Enables read-only viewing of server versions
- Used for diff comparisons

#### File Decoration Provider (`src/providers/enterpriseFileDecorationProvider.ts`)
- Adds visual indicators for file checkout status
- Shows badges and colors in file explorer
- Updates based on STARLIMS server state

### 5. UI Panels (`src/panels/`)

#### Resources Data View Panel
- Manages form resources (images, CSS, JavaScript)
- Provides CRUD operations for resources
- Integration with STARLIMS resource management

#### Generic Data View Panel
- Displays tabular data from data source execution
- Supports sorting, filtering, and export
- Handles large datasets efficiently

### 6. Express Server (`src/services/expressServer.ts`)

**Purpose:** Local development server for form debugging

**Features:**
- Serves static files for form development
- Proxy requests to STARLIMS server
- WebSocket support for real-time debugging
- CORS handling for cross-origin requests

## Data Flow Architecture

### 1. Item Exploration Flow
```
User → Tree View → Tree Provider → Enterprise Service → STARLIMS API → Database
                      ↓
                 Cache/Display ← Parse Response ← HTTP Response ← API Response
```

### 2. Check-out/Check-in Flow
```
User Action → Command Handler → Enterprise Service → STARLIMS API
     ↓                                                    ↓
File System ← Download Content ← ← ← ← ← ← ← ← ← ← ← Response
     ↓
Local Editing
     ↓
Check-in → Upload Changes → Enterprise Service → STARLIMS API
```

### 3. Script Execution Flow
```
User → Execute Command → Enterprise Service → STARLIMS Server
  ↓                                               ↓
Output Panel ← ← ← ← ← ← Parse Results ← ← ← Execution Results
```

## Security Architecture

### Authentication
- Uses STARLIMS native authentication
- Credentials stored in VS Code SecretStorage
- Session management with automatic re-authentication

### Data Protection
- No sensitive data stored in configuration files
- Temporary files cleaned up after use
- Secure communication over HTTPS (when configured)

### Access Control
- Respects STARLIMS user permissions
- Role-based feature availability
- Audit trail through STARLIMS logging

## Extension Points and Extensibility

### VS Code Integration Points

1. **Activity Bar**: Custom view container for STARLIMS
2. **Tree Views**: Multiple tree providers for different data types
3. **Commands**: Extensive command palette integration
4. **Menus**: Context menus for files and tree items
5. **Languages**: Custom language support for SSL/SLSQL
6. **Themes**: STARLIMS-specific color themes

### Configuration Schema
```json
{
  "STARLIMS.url": "Server URL",
  "STARLIMS.user": "Username",
  "STARLIMS.rootPath": "Local workspace path",
  "STARLIMS.browser": "Debug browser choice",
  "STARLIMS.urlSuffix": "API endpoint suffix"
}
```

## State Management

### Local State
- Active connections and sessions
- Cached tree data for performance
- User preferences and workspace settings

### Remote State Synchronization
- Periodic refresh of checkout status
- Real-time updates for collaborative environments
- Conflict resolution for concurrent edits

### File System State
- Local workspace synchronization
- Temporary file management
- Checkout status tracking

## Performance Considerations

### Caching Strategy
- Tree data cached with TTL
- API responses cached per session
- Lazy loading for large datasets

### Memory Management
- Dispose providers on deactivation
- Clean up event listeners
- Webview resource management

### Network Optimization
- Request batching where possible
- Compression for large file transfers
- Connection pooling for API calls

## Error Handling Architecture

### Layered Error Handling
1. **Network Layer**: Connection and HTTP errors
2. **API Layer**: STARLIMS-specific error codes
3. **Business Layer**: Validation and logic errors
4. **UI Layer**: User-friendly error messages

### Error Recovery
- Automatic retry for transient failures
- Graceful degradation for partial failures
- User-guided recovery for authentication issues

### Logging Strategy
- Extension output channel for debugging
- Structured logging with error levels
- User privacy protection in logs

## Deployment Architecture

### Extension Packaging
- Webpack bundling for optimal size
- Source map generation for debugging
- Platform-specific considerations

### Update Mechanism
- VS Code marketplace integration
- Automatic update notifications
- Backward compatibility handling

### STARLIMS Server Requirements
- HTTPServices web.config setting
- API endpoint availability
- Version compatibility matrix

## Integration Patterns

### VS Code API Usage
- Extension API for core functionality
- Language services for SSL/SLSQL
- Webview API for custom UI
- File system API for workspace integration

### STARLIMS API Patterns
- RESTful HTTP endpoints
- XML/JSON data formats
- Session-based authentication
- Batch operations support

### Development Tools Integration
- Debugger protocol for form debugging
- Browser integration for form testing
- Language server protocol for IntelliSense