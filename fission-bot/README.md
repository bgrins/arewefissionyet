
# Fission Bot

## Deploying

Add a file called build-env.js with:

```
module.exports = {
  SLACK_TOKEN: JSON.stringify("SLACK_TOKEN_GOES_HERE"),
  SLACK_ENDPOINT: JSON.stringify("SLACK_ENDPOINT_GOES_HERE"),
  WEBHOOK_SIGNATURE: JSON.stringify("WEBHOOK_SIGNATURE_GOES_HERE"),
};
```

Then do `wrangler publish`. This is published at https://fission-bot.bgrins.workers.dev/.