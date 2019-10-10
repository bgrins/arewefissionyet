
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

async function getTestMetadata() {
  const testMetadata = new Map();
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
    testMetadata.set(testPath, milestone);
  }

  return testMetadata;
}

// Fetch skipped tests per milestone:
//
// "Fission Target" title

async function fetchTestInfos() {
  let summaryData = {};

  console.log("Fetching test spreadsheet to figure out what to ignore");
  let testMetadata = await getTestMetadata();

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

    for (let component in obj.tests) {
      let lengthBeforeFilter = obj.tests[component].length;
      obj.tests[component] = obj.tests[component].filter(obj => {
        return true;
        // obj looks like:
        /*
        { 'skip-if':
            'fission || os == \'linux\' || (os == \'mac\' && debug) || (debug && os == \'win\' && bits == 64)',
          test:
              'browser/components/extensions/test/browser/browser_ext_devtools_network.js'
        }
        */
        if (!testMetadata.has(obj.test)) {
          console.error("Found a test with no metadata from the sheet:", obj.test);
        }

        return testMetadata.get(obj.test) == "M4";
      });
      let lengthAfterFilter = obj.tests[component].length;

      if (lengthBeforeFilter != lengthAfterFilter) {
        console.log("Component was filtered with non M4 tests", component, lengthBeforeFilter, lengthAfterFilter)
      }
    }


    summaryData[dateString] = obj;
    let fileName = `cache/test-info-fission/${dateString}.json`
    fs.writeFileSync(fileName, JSON.stringify(obj, null, 2));
  }
  fs.writeFileSync('skipped-failing-tests/all.json', JSON.stringify(summaryData, null, 2));
}

fetchTestInfos();
