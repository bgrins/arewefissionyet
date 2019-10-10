
var fs = require('fs');
const fetch = require("node-fetch");

if (!fs.existsSync('cache')) {
  fs.mkdirSync('cache');
}
if (!fs.existsSync('cache/test-info-fission')) {
  fs.mkdirSync('cache/test-info-fission');
}

// Returns an array of dates between the two dates
const getDatesBetween = (startDate, endDate) => {
  const dates = [];

  // Strip hours minutes seconds etc.
  let currentDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
  );

  while (currentDate <= endDate) {
      dates.push(currentDate);

      currentDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1, // Will increase month if over range
      );
  }

  return dates;
};

const TEST_METADATA = new Map();
async function getTestMetadata() {
  let response = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRmnRUOy-KDDScK8o8Z6aKRaEtXKXb39Yn2OOPXoMgZwcMC3Oce3jgSjI5-jRK0jLS73gQYLkfSTJ_/pub?gid=1560718888&single=true&output=csv"
  );
  let obj = await response.text();

  let rows = obj.split("\n");
  console.log(rows[0])
  let testPathPosition = rows[0].split(",").indexOf("Test");
  let milestoneColPosition = rows[0].split(",").indexOf("Fission Target");
  if (!testPathPosition || !milestoneColPosition) {
    throw new Error(`Fission spreadsheet doesn't have column for test (${testPathPosition}) or milestone: ${milestoneColPosition}`);
  }

  for (let row of rows.slice(1)) {
    console.log(row);
    let cols = row.split(",");
    let testPath = cols[testPathPosition];
    let milestone = cols[milestoneColPosition];
    TEST_METADATA.set(testPath, milestone);
  }
}

// Fetch skipped tests per milestone:
//
// "Fission Target" title

async function fetchTestInfos() {
  let summaryData = {};

  console.log("Fetching test spreadsheet to figure out what to ignore");
  let meta = await getTestMetadata();
  console.log(TEST_METADATA);

  console.log("First, importing data from before taskcluster artifacts");
  let items = fs.readdirSync("cache/imported-from-before-artifacts");
  for (let item of items) {
    if (item.endsWith("json")) {
      let date = item.split(".")[0];
      let text = fs.readFileSync(`cache/imported-from-before-artifacts/${item}`, "utf8");
      summaryData[date] = JSON.parse(text);
    }
  }

  console.log("Next, importing daily data from taskcluster artifacts");

  // const url = "https://index.taskcluster.net/v1/task/gecko.v2.mozilla-central.latest.source.test-info-fission/artifacts/public/test-info-fission.json";
  for (let date of getDatesBetween(new Date(2019,08,19), new Date())) {
    // YYYY-MM-DD
    var dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 ))
                              .toISOString()
                              .split("T")[0];
    console.log("Fetching", dateString);

    // YYYY.MM.DD
    let tcDate = dateString.replace(new RegExp("-", "g"), ".");
    let url =
      `https://index.taskcluster.net/v1/task/gecko.v2.mozilla-central.pushdate.${tcDate}.latest.source.test-info-fission/artifacts/public/test-info-fission.json`;

    let response = await fetch(url);
    let obj = await response.json();



    summaryData[dateString] = obj;
    let fileName = `cache/test-info-fission/${dateString}.json`
    fs.writeFileSync(fileName, JSON.stringify(obj));
  }
  fs.writeFileSync('skipped-failing-tests/all.json', JSON.stringify(summaryData));
}

fetchTestInfos();
