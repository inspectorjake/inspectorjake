# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Do NOT** open a public GitHub issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

We will respond within 48 hours and work with you to understand and address the issue.

## Security Considerations

### Local Communication Only

Inspector Jake communicates only via localhost WebSocket connections. No data is sent to external servers.

### Permissions

The Chrome extension requires these permissions:
- `activeTab`: To inspect the current tab
- `tabs`: To track tab changes
- `scripting`: To execute content scripts

### Data Handling

- No data is stored persistently
- No analytics or tracking
- All communication is local

## Best Practices for Users

1. Only run the MCP server when actively using it
2. Keep the extension and server updated
3. Review the extension permissions before installing
