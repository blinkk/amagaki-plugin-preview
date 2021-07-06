import { Common } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { createProxyServer } from 'http-proxy';
import express from 'express';

const revisionAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const auth = new GoogleAuth();

interface ParseHostnameResult {
    site: string;
    branchToken: string;
}

export function parseHostname(
    hostname: string
): ParseHostnameResult {
    const prefix = hostname.split('.')[0].split('-dot-')[0];
    const [site, branchToken] = prefix.split('--');
    return {
        site,
        branchToken,
    }
}

export const getCloudRunClient = async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const schema = require('./run-googleapis-rest-v1.json');
    const ep = new Common.Endpoint({
        auth: revisionAuth
    });
    ep.applySchema(ep, schema, schema, ep);
    return (ep as unknown);
}


export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());
    app.all('/*', async (req: express.Request, res: express.Response) => {
        let [site, branchToken] = ['', 'main'];
        if (req.query.site && req.query.branchToken) {
            site = req.query.site as string;
            branchToken = req.query.branchToken as string;
        } else {
            const parts = parseHostname(req.hostname);
            site = parts.site;
            branchToken = parts.branchToken;
        }
        if (req.query.debug) {
            console.log(
                `Attempting to find manifest matching -> ${site}, ${branchToken}`
            );
        }
        try {
            if (true) {
                // Get the Google API client for Cloud Run.
                const cloudRunClient = await getCloudRunClient() as any;
                cloudRunClient._options.rootUrl = 'https://us-central1-run.googleapis.com';
                // List all backends for a given site.
                // If a backend exists for the requested branch, use it, otherwise, fall back to the main/master.
                const result = await cloudRunClient.namespaces.routes.list({
                    parent: `namespaces/${process.env.GOOGLE_CLOUD_PROJECT}`,
                    labelSelector: `preview-server=true,preview-site=${site}`,
                    includeUninitialized: false,
                });
                // Site not deployed.
                if (!result.data || !result.data.items) {
                    throw new Error(`No backend found for ${site}`);
                }
                const audience = result.data.items[0].status.url;
                const routes = result.data.items[0].status.traffic;
                const revisionRoute = routes.find((route: any) => {
                    return route.url && route.tag === branchToken;
                });
                // No revision matches.
                if (!revisionRoute) {
                    throw new Error(`No backend found for ${site}/${branchToken}`);
                }
                const revisionUrl = revisionRoute.url;
                console.log(`audience: ${audience}`);
                console.log(`revisionUrl: ${revisionUrl}`);
                // Add Authorization: Bearer ... header to outgoing backend request.
                // Audience must be the Cloud Run service's primary URL.
                const client = await auth.getIdTokenClient(audience);
                const headers = await client.getRequestHeaders();
                req.headers['Authorization'] = headers['Authorization'];
                req.headers['x-preview-branch-token'] = branchToken;
                // req.headers['x-preview-branch'] = branch;
                const server = createProxyServer();
                server.web(req, res, {
                    target: revisionUrl,
                    changeOrigin: true,
                    preserveHeaderKeyCase: true,
                });
                server.on('error', (error: any, req: any, res: any) => {
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
                    proxyRes.headers['x-preview-branch-token'] = branchToken || '';
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                });
            }
        } catch (err) {
            res.status(500);
            res.contentType('text/plain');
            res.send(`Something went wrong. ${err}\n\n${err.stack}`);
            return;
        }
    });
    return app;
}
