import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Context, Telegraf } from 'telegraf';
import type { Update } from 'telegraf/typings/core/types/typegram';

export function launchServer(port: number, bot: Telegraf<Context<Update>>) {
  import('http').then((http) => {
    import('raw-body').then((getRawBody) => {
      import('./production').then(({ production }) => {
        import('../../api/setup').then(({ default: setupHandler }) => {
          const server = http.createServer(async (req, res) => {
            if (!req.url) {
              res.statusCode = 404;
              res.end();
              return;
            }

            if (
              req.method === 'GET' &&
              (req.url === '/' || req.url === '/api')
            ) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'Listening to bot events...' }));
              return;
            }

            if (req.method === 'GET' && req.url.startsWith('/api/setup')) {
              const [_, queryString] = req.url.split('?');
              const query: Record<string, string> = {};
              if (queryString) {
                for (const part of queryString.split('&')) {
                  const [k, v] = part.split('=');
                  if (k)
                    query[decodeURIComponent(k)] = v
                      ? decodeURIComponent(v)
                      : '';
                }
              }
              const fakeReq = Object.assign(req, { query }) as VercelRequest;
              const fakeRes = {
                ...res,
                status: (code: number) => {
                  res.statusCode = code;
                  return fakeRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
              } as unknown as VercelResponse;
              await setupHandler(fakeReq, fakeRes);
              return;
            }

            if (req.method === 'POST' && req.url === '/api') {
              let fakeReq: VercelRequest | null = null;
              let fakeRes: VercelResponse | null = null;
              try {
                const raw = await getRawBody.default(req);
                const body = JSON.parse(raw.toString());
                fakeReq = Object.assign(req, { body }) as VercelRequest;
                fakeRes = {
                  ...res,
                  status: (code: number) => {
                    res.statusCode = code;
                    return fakeRes;
                  },
                  json: (data: any) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                } as unknown as VercelResponse;
              } catch (err) {
                console.error(err);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }

              if (fakeReq && fakeRes) {
                try {
                  await production(fakeReq, fakeRes, bot);
                } catch (err) {
                  console.error(err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Internal Server Error' }));
                }
              }

              return;
            }

            res.statusCode = 404;
            res.end();
          });

          server.listen(port, () => {
            console.log(`HTTP server listening on port ${port}`);
          });
        });
      });
    });
  });
}
