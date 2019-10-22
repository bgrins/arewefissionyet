const Router = require("./router");
const JSON_HEADERS = new Headers([["Content-Type", "application/json"]]);

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * slackResponse builds a message for Slack with the given text
 * and optional attachment text
 *
 * @param {string} text - the message text to return
 */
function slackResponse(text) {
  let content = {
    response_type: "in_channel",
    type: "section",
    mrkdwn: true,
    text,
    attachments: [
      {
        text: "See more at <https://arewefissionyet.com/m4/timeline/>",
      },
    ],
  };

  return new Response(JSON.stringify(content), {
    headers: JSON_HEADERS,
    status: 200,
  });
}

function stringifyTestChange(test, isRemoval = true) {
  let path = test.path.split("/").pop();
  if (!isRemoval) {
    return `• *New failing test*: ${path}`;
  }
  let metadata = test.metadata.bug
    ? ` by ${test.metadata.assignee} in <${test.metadata.bug}|Bug ${
        test.metadata.bug.match(/\d+$/)[0]
      }>`
    : "";
  return `• *Fixed*: ${path}${metadata}`;
}
/*
TODO:
- Summarize counts for a day, week
- List tests fixed today instead of based on updateTime (which is really only relevant for the commit handler)
*/
async function statusHandler(request) {
  let resp = await fetch("https://arewefissionyet.com/cache/m4-timeline.json");
  let body = await resp.json();
  let { data, removalSummary } = body;
  let message = `There are *${removalSummary.remaining}* tests to go. There have been ${removalSummary.day} net tests fixed in the last day, ${removalSummary.week} in the last week, and ${removalSummary.month} in the last month.`;

  for (let date in data) {
    let removals = data[date].removals.map(t => stringifyTestChange(t));
    let additions = data[date].additions.map(t =>
      stringifyTestChange(t, false)
    );
    if (removals.length || additions.length) {
      message += `The most recent data I have is from ${date}, when the following things changed:\n${removals.join(
        "\n"
      )}\n${additions.join("\n")}`;
    }
    break;
  }
  return slackResponse(message);
}

async function commitHandler(request) {
  try {
    let timelineObject;

    let sig = new Headers(request.headers).get("X-Hub-Signature") || "";
    if (sig != WEBHOOK_SIGNATURE) {
      return new Response(`Missing or incorrect signature`);
    }

    if (request.method === "POST") {
      let body = await request.json();
      let doWeCare = body.commits.filter(c =>
        c.modified.includes("cache/m4-timeline.json") && !c.message.startsWith("Merge branch")
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

    let removalsStr = `${removals.join("\n")}`;
    let additionsStr = `${additions.join("\n")}`;

    // XXX:
    // include link to timeline and summary of total remaining
    // check request coming from gh
    let msg = `I just detected some Fission test changes:\n${removalsStr}\n${additionsStr}`;

    if (removals.length || additions.length) {
      await fetch(SLACK_ENDPOINT, {
        body: JSON.stringify({ text: msg }),
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return new Response(`Posted`);
    }
    return new Response(`Nothing to post`);
  } catch (e) {
    // ${e.toString()} for debugging
    return new Response(`Error`, { status: 500 });
  }
}

async function handleRequest(request) {
  const r = new Router();
  r.get(".*/status", req => statusHandler(req));
  r.post(".*/status", req => statusHandler(req));
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
