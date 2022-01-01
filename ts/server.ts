import fs from 'fs'
import path from 'path'
import Fastify from 'fastify'
import type { ViteDevServer } from 'vite'

const fastify: any = Fastify({
    logger: true
})

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

async function createServer(
    root = process.cwd(),
    isProd = process.env.NODE_ENV === 'production'
) {
    await fastify.register(require('fastify-express'))

    const resolve = (p: string) => path.resolve(__dirname, p)

    const indexProd = isProd
        ? fs.readFileSync(resolve('dist/client/index.html'), 'utf-8')
        : ''

    const manifest = isProd
        ? // @ts-ignore
        require('./dist/client/ssr-manifest.json')
        : {}

    let vite: ViteDevServer

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

    fastify.use('*', async (req: any, res: any) => {
        try {
            const url = req.originalUrl

            let template, render

            if (!isProd) {
                // always read fresh template in dev
                template = fs.readFileSync(resolve('index.html'), 'utf-8')
                template = await vite.transformIndexHtml(url, template)
                render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
            } else {
                template = indexProd
                // @ts-ignore
                render = await import('./dist/server/entry-server.js').then(i => i.render)
            }

            const [appHtml, preloadLinks] = await render(url, manifest)

            const html = template
                .replace(`<!--preload-links-->`, preloadLinks)
                .replace(`<!--app-html-->`, appHtml)

            res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
        } catch (e: any) {
            vite && vite.ssrFixStacktrace(e)
            console.log(e.stack)
            res.status(500).end(e.stack)
        }
    })

    return { fastify }
}

if (!isTest) {
    createServer().then(({ app }: any) =>
        fastify.listen(3000, () => {
            console.log('http://localhost:3000')
        })
    )
}

// for test use
exports.createServer = createServer
