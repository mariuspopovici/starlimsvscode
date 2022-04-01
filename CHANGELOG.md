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
