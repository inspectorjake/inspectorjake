/**
 * Network request capture — patches fetch() and XMLHttpRequest to collect
 * network traffic. Import this module for its side effects (executes immediately).
 */

import { MAX_NETWORK_REQUESTS } from './constants.js';

interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  statusText: string;
  type: 'fetch' | 'xhr';
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  duration: number;
  timestamp: number;
  error?: string;
}

const requests: NetworkEntry[] = [];
(window as any).__networkRequests = requests;

function pushRequest(entry: NetworkEntry) {
  requests.push(entry);
  if (requests.length > MAX_NETWORK_REQUESTS) requests.shift();
}

// --- Patch fetch() ---
const originalFetch = window.fetch.bind(window);
window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
  const startTime = Date.now();
  const request = new Request(...args);
  const method = request.method;
  const url = request.url;

  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  try {
    const response = await originalFetch(...args);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    pushRequest({
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      type: 'fetch',
      requestHeaders,
      responseHeaders,
      duration: Date.now() - startTime,
      timestamp: startTime,
    });

    return response;
  } catch (err) {
    pushRequest({
      url,
      method,
      status: 0,
      statusText: '',
      type: 'fetch',
      requestHeaders,
      duration: Date.now() - startTime,
      timestamp: startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

// --- Patch XMLHttpRequest ---
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  ...rest: any[]
) {
  (this as any).__networkCapture = {
    method,
    url: String(url),
    requestHeaders: {} as Record<string, string>,
    startTime: 0,
  };
  return originalXHROpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
  const capture = (this as any).__networkCapture;
  if (capture) {
    capture.requestHeaders[name] = value;
  }
  return originalXHRSetRequestHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function (...args: any[]) {
  const capture = (this as any).__networkCapture;
  if (capture) {
    capture.startTime = Date.now();

    this.addEventListener('loadend', () => {
      const responseHeaders: Record<string, string> = {};
      const rawHeaders = this.getAllResponseHeaders();
      if (rawHeaders) {
        rawHeaders.split('\r\n').forEach((line) => {
          const idx = line.indexOf(': ');
          if (idx > 0) {
            responseHeaders[line.substring(0, idx)] = line.substring(idx + 2);
          }
        });
      }

      pushRequest({
        url: capture.url,
        method: capture.method,
        status: this.status,
        statusText: this.statusText,
        type: 'xhr',
        requestHeaders: capture.requestHeaders,
        responseHeaders,
        duration: Date.now() - capture.startTime,
        timestamp: capture.startTime,
      });
    });

    this.addEventListener('error', () => {
      pushRequest({
        url: capture.url,
        method: capture.method,
        status: 0,
        statusText: '',
        type: 'xhr',
        requestHeaders: capture.requestHeaders,
        duration: Date.now() - capture.startTime,
        timestamp: capture.startTime,
        error: 'Network error',
      });
    });
  }

  return originalXHRSend.apply(this, args);
};
