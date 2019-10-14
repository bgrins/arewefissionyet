const Router = require("./router");

/**
 * Example of how router can be used in an application
 *  */
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

function webhookHandler(request) {
//   const body = await request.text();
//   const { action, issue, repository } = JSON.parse(body);
  //   const prefix_text = `An issue was ${action}:`;
  //   const issue_string = `${repository.owner.login}/${repository.name}#${issue.number}`;

  const init = {
    headers: { "content-type": "application/json" },
  };
  const responseBody = JSON.stringify({ some: "json" });
  return new Response(responseBody, init);

  //   return [
  //     {
  //       type: "section",
  //       text: {
  //         type: "mrkdwn",
  //         text: body,
  //       },
  //       //   accessory: {
  //       //     type: 'image',
  //       //     image_url: issue.user.avatar_url,
  //       //     alt_text: issue.user.login,
  //       //   },
  //     },
  //   ];
}

async function handleRequest(request) {
  const r = new Router();
  r.get(".*/webhook", () => new Response("Error: webhook requires POST"));
  r.post(".*/webhook", webhookHandler);
  //   r.get(".*/foo", req => handler(req));
  //   r.post(".*/foo.*", req => handler(req));
  //   r.get("/demos/router/foo", req => fetch(req)); // return the response from the origin

  r.get("/", () => new Response("Hello worker!")); // return a default message for the root route

  const resp = await r.route(request);
  return resp;
}
