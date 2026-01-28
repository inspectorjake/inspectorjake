# Contributing to Inspector Jake

Thank you for your interest in contributing to Inspector Jake!

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Chrome browser

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/inspectorjake/inspector-jake.git
   cd inspector-jake
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build all packages:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Project Structure

```
inspector-jake/
├── packages/
│   ├── mcp-server/        # MCP server published to npm
│   ├── chrome-extension/  # Chrome DevTools extension
│   └── shared/            # Shared types and utilities
```

## Development Workflow

### Chrome Extension

1. Build with watch mode:
   ```bash
   cd packages/chrome-extension
   npm run dev
   ```

2. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked from `packages/chrome-extension/dist`

3. Reload extension after changes

### MCP Server

1. Build with watch mode:
   ```bash
   cd packages/mcp-server
   npm run dev
   ```

2. Run locally:
   ```bash
   npm start
   ```

## Code Style

- Use TypeScript
- Follow existing patterns in the codebase
- Write tests for new functionality

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Run build: `npm run build`
5. Submit a pull request

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when creating issues.

## Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) for suggestions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
