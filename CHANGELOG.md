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
