# Inspector Jake Chrome Extension

Chrome DevTools extension for Inspector Jake - let AI agents see what you see.

## Installation

### Chrome Web Store

1. Build the extension from the repo root:
   ```bash
   npm run build
   ```
2. Create a zip from inside `dist` so `manifest.json` is at the zip root:
   ```bash
   cd packages/chrome-extension/dist
   zip -r ../../../inspector-jake-chrome-store.zip .
   ```
3. Upload `inspector-jake-chrome-store.zip` in the Chrome Web Store Developer Dashboard.

Important: do not zip the `packages/chrome-extension/dist` folder itself as a parent folder. The zip must open directly to `manifest.json`, `icons/`, `assets/`, etc.

### Manual Installation (Development)

1. Clone the repository and build:
   ```bash
   git clone https://github.com/agent-jake/inspector-jake.git
   cd inspector-jake
   npm install
   npm run build
   ```

2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `packages/chrome-extension/dist` folder

## Usage

1. Open any web page in Chrome
2. Open DevTools (F12 or right-click → Inspect)
3. Click the "Jake" tab in DevTools
4. Click "Connect" to connect to the MCP server

The extension will now share page information with your AI assistant through the MCP server.

## Features

- **Element Selection**: Select elements in DevTools and share them with AI
- **Page Inspection**: Get accessibility tree information
- **Screenshots**: Capture page or element screenshots
- **Interactions**: Let AI click, type, and navigate

## Privacy

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

**TL;DR**: All data stays local. No external servers, no analytics, no tracking.

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build
```

## License

MIT
