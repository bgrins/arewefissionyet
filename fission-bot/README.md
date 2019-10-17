
# Fission Bot

## Deploying

Add a file called build-env.js with:

```
module.exports = {
  SLACK_TOKEN: JSON.stringify("SLACKTOKENGOESHERE"),
};
```

Then do `wrangler publish`
