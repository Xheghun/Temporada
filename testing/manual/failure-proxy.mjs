// Local Android test fixture only: proxy 3006 → isolated mock 3005. Never expose publicly.
import http from 'node:http';
import { Buffer } from 'node:buffer';
let documentFailureStatus = 0,
  holdAfterDrop = false;
const server = http.createServer((request, response) => {
  if (request.url === '/__test/failure' && request.method === 'POST') {
    const requestChunks = [];
    request.on('data', (part) => requestChunks.push(part));
    request.on('end', () => {
      const settings = JSON.parse(Buffer.concat(requestChunks).toString());
      documentFailureStatus = settings.status;
      holdAfterDrop = settings.holdAfterDrop === true;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
    return;
  }
  if (
    request.method === 'POST' &&
    request.url === '/me/documents' &&
    documentFailureStatus
  ) {
    request.resume();
    response.writeHead(documentFailureStatus, {
      'content-type': 'application/json',
    });
    response.end(
      JSON.stringify({
        code:
          documentFailureStatus === 422
            ? 'unknown_document_type'
            : 'injected_failure',
      }),
    );
    return;
  }
  const upstreamRequest = http.request(
    {
      hostname: '127.0.0.1',
      port: 3005,
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstreamRequest.on('error', () => {
    if (holdAfterDrop && request.url === '/me/documents') {
      holdAfterDrop = false;
      documentFailureStatus = 503;
      response.destroy();
      return;
    }
    if (!response.headersSent)
      response.writeHead(502, { 'content-type': 'application/json' });
    response.end('{"code":"network"}');
  });
  request.pipe(upstreamRequest);
});
server.listen(3006, '127.0.0.1');
