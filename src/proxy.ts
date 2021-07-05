import { GoogleAuth } from 'google-auth-library';
import { createProxyServer } from 'http-proxy';
import express from 'express';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

interface ParseHostnameResult {
    site: string;
    branch: string;
}

export function parseHostname(
    hostname: string
): ParseHostnameResult {
    const prefix = hostname.split('.')[0];
    const [site, branch] = prefix.split('--');
    return {
        site,
        branch,
    }
}

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());
    app.all('/*', async (req: express.Request, res: express.Response) => {
        let [ site, branch ] = [ '', 'main' ];
        if (req.query.site && req.query.branch) {
            site = req.query.site as string;
            branch = req.query.branch as string;
        } else {
            const parts = parseHostname(req.hostname);
            site = parts.site;
            branch = parts.branch;
        }
        if (req.query.debug) {
            console.log(
                `Attempting to find manifest matching -> ${site}, ${branch}`
            );
        }
        try {
            if (true) {
                const backendHostname = 'https://main---hsw-r5nyjarj7q-uc.a.run.app/';
                // Add Authorization: Bearer ... header to outgoing backend request.
                const client = await auth.getClient();
                const headers = await client.getRequestHeaders();
                req.headers = headers;
                // req.url = updatedUrl;
                const server = createProxyServer();
                server.web(req, res, {
                    target: backendHostname,
                    changeOrigin: true,
                    preserveHeaderKeyCase: true,
                });
                server.on('error', (error: any , req: any , res: any) => {
                    // Reduce logspam.
                    if (`${error}`.includes('socket hang up')) {
                        return;
                    }
                    console.log(`Error serving ${req.url}: ${error}`);
                });
                server.on('proxyRes', (proxyRes: any, message: any, res: any) => {
                    // Avoid modifying response if headers already sent.
                    if (res.headersSent) {
                        return;
                    }
                    delete proxyRes.headers['x-cloud-trace-context'];
                    proxyRes.headers['x-preview-site'] = site || '';
                    proxyRes.headers['x-preview-branch'] = branch || '';
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                });
            }
        } catch (err) {
            res.status(500);
            res.contentType('text/plain');
            res.send(`Something went wrong. ${err}`);
            return;
        }
    });
    return app;
}
