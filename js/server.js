// @ts-check
const fs = require('fs')
const path = require('path')
const fastify = require('fastify')()
const Youch = require('youch')

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

async function createServer(
    root = process.cwd(),
    isProd = process.env.NODE_ENV === 'production'
) {
    await fastify.register(require('fastify-express'))
    
    const resolve = (p) => path.resolve(__dirname, p)

    const indexProd = isProd
        ? fs.readFileSync(resolve('dist/client/index.html'), 'utf-8')
        : ''

    const manifest = isProd
        ? // @ts-ignore
        require('./dist/client/ssr-manifest.json')
        : {}

    /**
     * @type {import('vite').ViteDevServer}
     */
    let vite

    if (!isProd) {
        vite = await require('vite').createServer({
            root,
            logLevel: isTest ? 'error' : 'info',
            server: {
                middlewareMode: 'ssr',
                watch: {
                    // During tests we edit the files too fast and sometimes chokidar
                    // misses change events, so enforce polling for consistency
                    usePolling: true,
                    interval: 100
                }
            }
        })
        // use vite's connect instance as middleware
        fastify.use(vite.middlewares)
    } else {
        fastify.use(require('compression')())

        fastify.use(
            require('serve-static')(resolve('dist/client'), {
                index: false
            })
        )
    }

    fastify.use('*', async (req, res) => {
        try {
            const url = req.originalUrl

            let template, render

            if (!isProd) {
                // always read fresh template in dev
                template = fs.readFileSync(resolve('index.html'), 'utf-8')
                template = await vite.transformIndexHtml(url, template)
                render = (await vite.ssrLoadModule('/src/entry-server.js')).render
            } else {
                template = indexProd
                render = require('./dist/server/entry-server.js').render
            }

            const [appHtml, preloadLinks] = await render(url, manifest)

            const html = template
                .replace(`<!--preload-links-->`, preloadLinks)
                .replace(`<!--app-html-->`, appHtml)

            res
                .status(200)
                .set({ 'Content-Type': 'text/html' })
                .end(html)
        } catch (e) {
            const youch = new Youch(e, req)
            
            vite && vite.ssrFixStacktrace(e)
            console.log(e.stack)

            youch
                .toHTML()
                .then(() => {
                    res
                        .writeHead(200, { 'content-type': 'text/html' })
                        .end(e.stack)
                })
        }
    })

    return { fastify }
}

if (!isTest) {
    createServer().then(({ app }) =>
        fastify.listen(3000, () => {
            console.log('Server listenting on localhost:', fastify.server.address().port)
        })
    )
}

// for test use
exports.createServer = createServer
