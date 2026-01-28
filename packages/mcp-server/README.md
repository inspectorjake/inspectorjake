# @agent-jake/inspector-jake-mcp

MCP server for Inspector Jake - inspect web pages via Chrome DevTools.

[![npm version](https://badge.fury.io/js/@agent-jake%2Finspector-jake-mcp.svg)](https://www.npmjs.com/package/@agent-jake/inspector-jake-mcp)

## Installation

```bash
npx @agent-jake/inspector-jake-mcp
```

Or install globally:

```bash
npm install -g @agent-jake/inspector-jake-mcp
inspector-jake-mcp
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

**macOS/Linux:** `~/.config/claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

### Command Line Options

```bash
inspector-jake-mcp --port 8765  # WebSocket port (default: 8765)
inspector-jake-mcp --help       # Show help
```

## Requirements

- Chrome browser with Inspector Jake extension installed
- Node.js 18+

## Available Tools

### `interactive_context`

Get the ARIA accessibility tree of the current page with element references for automation.

### `browser_click`

Click an element by reference ID or CSS selector.

**Parameters:**
- `ref` (string): Element reference from interactive_context
- `selector` (string): CSS selector (alternative to ref)

### `browser_type`

Type text into an input field.

**Parameters:**
- `ref` (string): Element reference
- `selector` (string): CSS selector
- `text` (string): Text to type

### `browser_screenshot`

Capture a screenshot of the page or a specific element.

**Parameters:**
- `ref` (string, optional): Element reference to screenshot
- `selector` (string, optional): CSS selector to screenshot
- `fullPage` (boolean, optional): Capture full page

### `browser_navigate`

Navigate to a URL.

**Parameters:**
- `url` (string): URL to navigate to

### `get_selected_element`

Get information about the element currently selected in Chrome DevTools.

## License

MIT
