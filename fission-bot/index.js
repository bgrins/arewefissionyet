const Router = require('./router')

/*
- Collect JSON from m4-timeline.json (fetch from gh)
- Summarize counts for a day, week
- List tests fixed today
*/

/**
 * Example of how router can be used in an application
 *  */
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handler(request) {
    let now = Date.now();
    await new Promise(r=>setTimeout(r, 1));
    const init = {
        headers: { 'content-type': 'application/json' },
    }
    const body = JSON.stringify({ some: Date.now() - now })
    return new Response(body, init)
}

async function handleRequest(request) {
    const r = new Router()
    // Replace with the approriate paths and handlers
    r.get('.*/bar', () => new Response('responding for /bar'))
    r.get('.*/foo', req => handler(req))
    r.post('.*/foo.*', req => handler(req))
    r.get('/demos/router/foo', req => fetch(req)) // return the response from the origin

    r.get('/', () => new Response('Hello worker!')) // return a default message for the root route

    const resp = await r.route(request)
    return resp
}
