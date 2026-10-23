# Privacy Policy

_Last updated: October 23, 2026_

Inspector Jake is a Chrome extension and a local MCP server that let an AI coding agent on your computer, such as Claude Code, see the web page you're working on. This policy covers both.

## What the extension reads

When you use it, the extension can read:

- Elements and screen regions you capture, including screenshots of them and the notes you write.
- Page details your agent asks for: the URL and title, the DOM and accessibility tree, computed CSS, console messages, and network requests made by the page (URLs, status codes and headers).
- Messages you type in the panel's Chat view.

So it can answer those requests, the extension keeps a log of each page's recent console messages (up to 1,000) and network requests (up to 500) in that tab's memory. The log is thrown away when the page reloads or closes. It's only read when your agent asks for it through a session you connected in the Inspector Jake DevTools panel.

## Where it goes

Everything stays on your computer. The extension sends data only to the Inspector Jake MCP server running on your own machine, at `127.0.0.1`. It never sends data to us or to any other server, and it has no analytics, tracking, or ads.

Your AI agent may send what it receives to its own provider (for example, Claude Code sends it to Anthropic) as part of your conversation with it. That is covered by your agent's privacy policy and terms.

## What is stored

- Your panel settings are stored in Chrome's local extension storage.
- Captures are kept in the extension's memory until you clear them or Chrome stops the extension.
- Chat history is kept in Chrome's session storage, which Chrome erases when you quit the browser.

Nothing is sold, shared, or used for advertising or credit decisions.

## Contact

Questions? Open an issue at https://github.com/inspectorjake/inspectorjake/issues.
