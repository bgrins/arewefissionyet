const Router = require("./router");

console.log(SLACK_TOKEN);

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
let JSON_HEADERS = new Headers([["Content-Type", "application/json"]]);

/*
TODO:
- Summarize counts for a day, week
- List tests fixed today
*/
async function handler(request) {
  //   let now = Date.now();
  let resp = await fetch("https://arewefissionyet.com/cache/m4-timeline.json");
  let body = await resp.json();
  for (let date in body) {
    let removals = body[date].removals.map(removal => {
      let metadata = removal.metadata.bug
        ? ` fixed by ${removal.metadata.assignee} in ${removal.metadata.bug}`
        : "";
      return `* ${removal.path}${metadata}`;
    });
    if (removals.length) {
      removals = `, when the following tests were fixed:

${removals.join("\n")}`;
    }
    let message = `
There are ${body[date].remaining} tests remaining. I last gathered data for ${date}${removals}
`;
    // return new Response(message);
    return slackResponse(message);
  }
  //   return new Response(JSON.stringify(body), init);
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
  r.get(".*/status", req => handler(req));
  r.get("/", () => new Response("Fission bot - https://arewefissionyet.com/"));

  // Example:
  // r.post(".*/foo.*", req => handler(req));
  // r.get("/demos/router/foo", req => fetch(req)); // return the response from the origin

  const resp = await r.route(request);
  return resp;
}
