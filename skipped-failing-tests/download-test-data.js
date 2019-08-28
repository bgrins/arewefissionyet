
var fs = require('fs');

// Sample test data taken from: https://taskcluster-artifacts.net/CkHo9KhFT6Gg-rnTB45EwA/0/public/test-info.json

async function run() {

  let text = fs.readFileSync('sample.json', 'utf8');
  let obj = JSON.parse(text);
  console.log(text);
// fs.writeFileSync(cachedFilePath, `Fetched from ${url}\n\n${artifactData}`);

}

run();

// async function populateUsageData(rev) {
//   // Skip usage data for now since we aren't showing it in the tree until
//   // https://bugzilla.mozilla.org/show_bug.cgi?id=1443328.
//   return;
//   if (!rev) {
//     throw "Need a rev";
//   }
//   rev = getPrettyRev(rev);

//   // Don't have data until now
//   if (moment(rev) < moment("2017-11-17") || moment(rev) > moment().subtract(1, 'days')) {
//     return;
//   }

//   console.log(`Fetching usage data for ${rev}`);

//   var cachedFilePath = `cache/instrumentation/${rev}/xulsummary.txt`;
//   if (fs.existsSync(cachedFilePath)) {
//     console.log(`File already exists: ${cachedFilePath}`);
//     return;
//   }

//   const tomorrowRev = moment(rev).add(1, 'days').format('YYYY-MM-DD');
//   const query = {
//     "sort": { "repo.push.date": "desc" },
//     "limit": 1,
//     "from": "task.task.artifacts",
//     "where": {
//       "and": [
//         { "eq": { "name": "public/test_info/xulsummary.txt" } },
//         { "gte": { "repo.push.date": { "date": rev } } },
//         { "lt": { "repo.push.date": { "date": tomorrowRev } } },
//       ]
//     },
//     "select": ["task.artifacts.url", "repo"],
//     format: 'list',
//   }

//   const queryResult = await request({
//     url: activeData,
//     method: "POST",
//     json: query,
//   });
//   let firstMcPush = queryResult.data.filter(d => d.repo.branch.name === "mozilla-central")[0];
//   if (!firstMcPush) {
//     console.log(`Skipping result for ${rev} (${queryResult.data.length} pushes, 0 on m-c)`, JSON.stringify(queryResult));
//     return;
//   }

//   let { url } = firstMcPush.task.artifacts;
//   console.log(`Found artifact at ${url}`);
//   if (!url) {
//     throw `Invalid data ${JSON.stringify(queryResult)}`;
//   }

//   const artifactData = await request({
//     url: url,
//     gzip: true,
//   });

//   if (!fs.existsSync(`cache/instrumentation/${rev}`)) {
//     fs.mkdirSync(`cache/instrumentation/${rev}`);
//   }
//   fs.writeFileSync(cachedFilePath, `Fetched from ${url}\n\n${artifactData}`);
// }