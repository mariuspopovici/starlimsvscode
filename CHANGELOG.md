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

### Fixed

- Made STARLIMS URL setting work with or without a trailing / or starthtml.lims
