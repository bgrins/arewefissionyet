const Router = require("./router");

console.log(SLACK_TOKEN);

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
let JSON_HEADERS = new Headers([["Content-Type", "application/json"]]);

function stringifyTestChange(test) {
  let metadata = test.metadata.bug
    ? ` fixed by ${test.metadata.assignee} in ${test.metadata.bug}`
    : "";
  return `* ${test.path}${metadata}`;
}
/*
TODO:
- Summarize counts for a day, week
- List tests fixed today
*/
async function statusHandler(request) {
  //   let now = Date.now();
  let resp = await fetch("https://arewefissionyet.com/cache/m4-timeline.json");
  let body = await resp.json();
  let { data, updateTime } = body;
  for (let date in data) {
    let removals = data[date].removals.map(stringifyTestChange);
    if (removals.length) {
      removals = `, when the following tests were fixed:

${removals.join("\n")}`;
    }
    let message = `
There are ${
      data[date].remaining
    } tests remaining. I last gathered data for ${date} at ${new Date(
      updateTime
    ).toString()}${removals}
`;
    // return new Response(message);
    return slackResponse(message);
  }
}

async function commitHandler(request) {
  const { headers } = request;
  const contentType = headers.get("content-type");
  if (contentType.includes("application/json")) {
    let body = await request.json();
    return new Response("Received POST " + JSON.stringify(body));
  }

  let resp = await fetch("https://arewefissionyet.com/cache/m4-timeline.json");
  let body = await resp.json();
  let { data, updateTime } = body;

  let removals = [];
  let additions = [];
  for (let date in data) {
    removals = removals.concat(
      data[date].removals
        .filter(removal => removal.updateTime == updateTime)
        .map(stringifyTestChange.bind(null, true))
    );
    additions = additions.concat(
      data[date].additions
        .filter(additions => additions.updateTime == updateTime)
        .map(stringifyTestChange.bind(null, false))
    );
  }

  return new Response(`Changes for ${new Date(updateTime).toString()}:
Removals: ${removals.join("\n")}
Additions: ${additions.join("\n")}
`);
}

/**
 * slackResponse builds a message for Slack with the given text
 * and optional attachment text
 *
 * @param {string} text - the message text to return
 */
function slackResponse(text) {
  let content = {
    response_type: "in_channel",
    text: text,
    attachments: [],
  };

  return new Response(JSON.stringify(content), {
    headers: JSON_HEADERS,
    status: 200,
  });
}

async function handleRequest(request) {
  const r = new Router();
  r.get(".*/status", req => statusHandler(req));
  r.get(".*/commit", req => commitHandler(req));
  r.post(".*/commit", req => commitHandler(req));
  r.get(
    "/",
    () =>
      new Response(`Welcome to fission bot. See more:
- https://arewefissionyet.com/
- https://fission-bot.bgrins.workers.dev/status
- https://fission-bot.bgrins.workers.dev/commit
`)
  );

  // Example:
  // r.post(".*/foo.*", req => handler(req));
  // r.get("/demos/router/foo", req => fetch(req)); // return the response from the origin

  const resp = await r.route(request);
  return resp;
}
