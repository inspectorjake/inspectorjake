# Privacy Policy for Inspector Jake MCP

**Last Updated:** January 2026

## Overview

Inspector Jake MCP is a Chrome extension that enables AI assistants to inspect and interact with web pages through Chrome DevTools. This privacy policy explains how the extension handles your data.

## Data Collection

**Inspector Jake MCP does not collect, store, or transmit any personal data.**

### What the extension accesses:
- **Page content**: The extension can read the DOM structure and accessibility tree of web pages you inspect
- **Screenshots**: When requested by an AI assistant, the extension can capture screenshots of the current page
- **User selections**: Elements you select in Chrome DevTools are communicated to the MCP server

### Where data goes:
- All data stays on your local machine
- Communication occurs only between the Chrome extension and a locally-running MCP server via WebSocket
- No data is sent to external servers, cloud services, or third parties

## Local Communication

The extension connects to an MCP (Model Context Protocol) server running on your local machine:
- Default connection: `ws://localhost:8765`
- This server runs entirely on your computer
- You control when the server runs and what AI assistants connect to it

## No Analytics or Tracking

- No analytics services
- No usage tracking
- No cookies or persistent identifiers
- No telemetry

## Data Security

- All communication is local (localhost only)
- No authentication credentials are stored
- No data persists between browser sessions

## Third-Party Services

Inspector Jake MCP does not integrate with any third-party services. The extension only communicates with the locally-running MCP server that you install and control.

## Changes to This Policy

Any changes to this privacy policy will be reflected in the extension's repository and this document will be updated with a new date.

## Contact

For privacy concerns or questions:
- GitHub Issues: https://github.com/inspectorjake/inspector-jake/issues

## Open Source

Inspector Jake MCP is open source. You can review the complete source code at:
https://github.com/inspectorjake/inspector-jake
