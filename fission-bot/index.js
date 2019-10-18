const Router = require("./router");

console.log(SLACK_TOKEN);

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
let JSON_HEADERS = new Headers([["Content-Type", "application/json"]]);

function stringifyTestChange(test, isRemoval = true) {
  if (!isRemoval) {
    return `* New failing test: ${test.path}`;
  }
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
    let removals = data[date].removals.map(t => stringifyTestChange(t));
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
  try {
    let timelineObject;
    if (request.method === "POST") {
      let body = await request.json();
      let doWeCare = body.commits.filter(c =>
        c.modified.includes("cache/m4-timeline.json")
      ).length;

      if (!doWeCare) {
        return new Response("Nothing to do");
      }

      let afterRevision = body.after;
      let commitTimelineURL = `https://raw.githubusercontent.com/bgrins/arewefissionyet/${afterRevision}/cache/m4-timeline.json`;

      try {
        let commitTimeline = await fetch(commitTimelineURL);
        commitTimeline = await commitTimeline.text();
        timelineObject = JSON.parse(commitTimeline);
      } catch (e) {
        return new Response(
          `Please include the "after" commit revision in the POST data (tried fetching ${commitTimelineURL}) and got the error (${e.toString()})`,
          { status: 500 }
        );
      }
    } else {
      let resp = await fetch(
        "https://arewefissionyet.com/cache/m4-timeline.json"
      );
      timelineObject = await resp.json();
    }
    let { data, updateTime } = timelineObject;
    let removals = [];
    let additions = [];
    for (let day in data) {
      removals = removals.concat(
        data[day].removals
          .filter(t => t.updateTime == updateTime)
          .map(t => stringifyTestChange(t))
      );
      additions = additions.concat(
        data[day].additions
          .filter(t => t.updateTime == updateTime)
          .map(t => stringifyTestChange(t, false))
      );
    }

    let removalsStr = `${removals.length ? "\nRemovals:\n" : ""}${removals.join(
      "\n"
    )}`;
    let additionsStr = `${
      additions.length ? "\nAdditions:\n" : ""
    }${additions.join("\n")}`;

    return new Response(
      `Changes for ${new Date(
        updateTime
      ).toString()}:${removalsStr}${additionsStr}`
    );
  } catch (e) {
    return new Response(`${e.toString()}`, { status: 500 });
  }
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
