# Change Log

All notable changes to the "STARLIMS VS Code" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2018-11-09

- Initial release

## [1.1.0] - 2022-03-31

### Changed

- Updated dependencies
- Updated for new VS Code extension template
- Refactored server side API and implemented a URI based mechanism for referencing dictionary code items.
- Changed extension setting storage and introduced an activation command.

### Added

- Get local version of remote script, creates a local file in current workspace
- Implemented remote copy view using a TextDocumentContentProvider implementation
- Added _Compare local with remote_ command
- LICENSE.md

## [1.1.1] - 2022-04-01

### Changed

- Reversed window order in diff view to be consistent with VS Code / Git compare

### Added

- Added Get Local Version to remote version editor window context menu
- Activation of extension when executing a compare command
- Showing remote checkout status in explorer tree

### Fixed

- Made STARLIMS URL setting work with or without a trailing / or starthtml.lims

## [1.2.0] - 2023-06-23

### Changed

- Display the extension on the activity bar of vscode
- Automatically copy selected files to local folder and open it

### Added

- Check in/out items

## [1.2.4] - 2023-07-04

- implemented a basic search functionality
- open HTML forms in browser

## [1.2.5] - 2023-07-06

- added root path to configuration
- don't show starlimsvscode functions on files not in root path

## [1.2.6] - 2023-07-08

- add view and clear log files

## [1.2.7] - 2023-07-08

- fixed path issues

## [1.2.8] - 2023-07-10

- add new items
- delete existing items

## [1.2.9] - 2023-07-12

- run XFD forms via the STARLIMS bridge

## [1.2.25] - 2023-07-23

- added support for navigating the tables tree (database and dictionary)
- added support for checkin and checkout of tables
- added table commands in tree to generate SELECT, DELETE, INSERT and UPDATE SQL statements into the active editor
- added table command to send the selected table name to the active editor

## [1.2.29] - 2023-07-23

- added support for navigating to the code item under the cursor (go to server script, data source, etc.)
- reorganized context menu options for better usability
- fixed misc. bugs

## [1.2.38] - 2023-07-27

- initial support for pending checkins

## [1.2.41] - 2023-07-28

- added pending checkin operations

## [1.2.42] - 2023-07-29

- added table definition view

## [1.2.43] - 2023-07-29

- improved "Go to Item" autodetection to include procedure
- added local, external and included procedure support in go to server script

## [1.2.44] - 2023-07-29

- fixed bug that prevented check in / check out from document of server scripts

## [1.2.50] - 2023-08-05

- added support for automatic upgrade of backend API
- updated icons
- added a new output channel for the STARLIMS server log
- run script includes server log content in the output channel along with script result

## [1.2.59] - 2023-08-10

- added initial support for full text search in code items, similar to the STARLIMS designer global search

## [1.2.63] - 2023-09-06

- Bug fix: check Out message not showing after closing it.

## [1.2.64] - 2023-09-08

- Updated icons
- Storing user password is secure storage vs settings.json
- Show form resources for HTML and XFD forms

## [1.2.67] - 2023-09-13

- Initial support for editing form resources for HTML and XFD forms

## [1.2.72] - 2023-09-13

- Added rename command for all applicable item types

## [1.2.74] - 2023-09-18

- Added move command

## [1.2.79] - 2023-11-29

- Added support for ESLint rules when editing Javascript form code behind with STARLIMS specific objects and types. Config file .eslintrc.json and package.json is automatically deployed in the root folder during activation
- Integrated proof-of-concept forms designer application in backend package
- Added urlSuffix setting for handling API calls on older STARLIMS runtime where HTTPServices web.config key is not recognized

## [1.2.81] - 2024-01-27

- Misc. fixes
- Enhancements to forms designer

## [1.2.82] - 2024-01-31

- Misc. fixes
