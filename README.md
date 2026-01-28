# Inspector Jake

Let AI agents inspect and interact with web pages through Chrome DevTools.

[![npm version](https://badge.fury.io/js/@agent-jake%2Finspector-jake-mcp.svg)](https://www.npmjs.com/package/@agent-jake/inspector-jake-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What is Inspector Jake?

Inspector Jake is an MCP (Model Context Protocol) server that connects AI assistants like Claude to Chrome DevTools. Agents can see what element the user has selected in DevTools, take snapshots of the page, and interact with elements.

## Architecture

```
┌─────────────────┐                    ┌─────────────────────┐
│   AI Agent      │───MCP Protocol────▶│   MCP Server        │
│ (Claude, etc)   │                    │   inspector-jake    │
└─────────────────┘                    └──────────┬──────────┘
                                                  │ WebSocket
                                                  ▼
                                       ┌─────────────────────┐
                                       │  Chrome Extension   │
                                       │  (connected tab)    │
                                       └──────────┬──────────┘
                                                  │
                                                  ▼
                                       ┌─────────────────────┐
                                       │  DevTools Panel     │
                                       │  (element tracking) │
                                       └─────────────────────┘
```

## Quick Start

### 1. Install the MCP Server

```bash
npx @agent-jake/inspector-jake-mcp
```

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on macOS/Linux):

```json
{
  "mcpServers": {
    "inspector-jake": {
      "command": "npx",
      "args": ["@agent-jake/inspector-jake-mcp"]
    }
  }
}
```

### 3. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `packages/chrome-extension/dist` folder

### 4. Connect

1. Navigate to any webpage
2. Open DevTools (F12)
3. Click the "Jake" tab
4. Click "Connect" to your MCP session

## MCP Tools

| Tool | Description |
|------|-------------|
| `inspector_get_selected_element` | Get element currently selected in DevTools Elements panel |
| `inspector_snapshot` | Get ARIA accessibility tree of page |
| `inspector_screenshot` | Capture screenshot of page or element |
| `inspector_get_page_info` | Get page URL, title, viewport size |

## Tool Examples

### inspector_get_selected_element

**Response (element selected):**
```json
{
  "selected": true,
  "element": {
    "tagName": "button",
    "id": "submit-btn",
    "className": "btn btn-primary",
    "selector": "#submit-btn",
    "innerText": "Submit",
    "attributes": [
      {"name": "type", "value": "submit"}
    ],
    "rect": {"x": 100, "y": 200, "width": 120, "height": 40}
  }
}
```

### inspector_snapshot

Returns an ARIA accessibility tree representation of the page.

### inspector_screenshot

**Request:**
```json
{
  "selector": "#submit-btn",
  "fullPage": false
}
```

**Response:**
```json
{
  "image": "data:image/png;base64,...",
  "width": 1920,
  "height": 1080
}
```

### inspector_get_page_info

**Response:**
```json
{
  "url": "https://example.com/page",
  "title": "Example Page",
  "viewport": {"width": 1920, "height": 1080}
}
```

## Session Discovery

The extension discovers MCP servers using predefined session names, each mapping to a unique port. When the MCP server starts, it picks an available name and listens on its corresponding port. The extension scans ports to find active servers.

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- Chrome browser

### Setup

```bash
git clone https://github.com/inspectorjake/inspector-jake.git
cd inspector-jake
npm install
npm run build
npm test
```

### Project Structure

```
inspector-jake/
├── packages/
│   ├── mcp-server/          # MCP server (npm package)
│   │   ├── src/
│   │   │   ├── index.ts     # CLI entry
│   │   │   ├── server.ts    # MCP server + tools
│   │   │   └── ws-server.ts # WebSocket for extension
│   │   └── package.json
│   │
│   ├── chrome-extension/    # Chrome extension (Manifest V3)
│   │   ├── src/
│   │   │   ├── background/  # Service worker
│   │   │   ├── content/     # Content script
│   │   │   ├── devtools/    # DevTools panel
│   │   │   └── popup/       # Extension popup (Vue)
│   │   ├── manifest.json
│   │   └── package.json
│   │
│   └── shared/              # Shared types and utilities
│       └── package.json
│
└── package.json             # Workspace root
```

### Watch Mode

```bash
# In separate terminals:
cd packages/shared && npm run dev
cd packages/mcp-server && npm run dev
cd packages/chrome-extension && npm run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy.

## License

MIT - see [LICENSE](LICENSE)
