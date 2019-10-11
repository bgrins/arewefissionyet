var fs = require("fs");
const fetch = require("node-fetch");
const convertPreArtifactData = require("./convert-csv-to-json");

if (!fs.existsSync("cache")) {
  fs.mkdirSync("cache");
}
if (!fs.existsSync("cache/test-info-fission")) {
  fs.mkdirSync("cache/test-info-fission");
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
      currentDate.getDate() + 1 // Will increase month if over range
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
  let testPathPosition = rows[0].split(",").indexOf("Test");
  let milestoneColPosition = rows[0].split(",").indexOf("Fission Target");
  if (!testPathPosition || !milestoneColPosition) {
    throw new Error(
      `Fission spreadsheet doesn't have column for test (${testPathPosition}) or milestone: ${milestoneColPosition}`
    );
  }

  for (let row of rows.slice(1)) {
    let cols = row.split(",");
    let testPath = cols[testPathPosition];
    let milestone = cols[milestoneColPosition];
    testMetadata.set(testPath, milestone);
  }

  return testMetadata;
}

function shouldIgnoreComponent(component) {
  let ignoredComponents = [
    "Core::Privacy: Anti-Tracking",
    "Core::Plug-ins",
    "DevTools::",
    "Remote Protocol::"
  ];
  for (let ignoredComponent of ignoredComponents) {
    if (component.startsWith(ignoredComponent)) {
      return true;
    }
  }
  return false;
}

async function fetchTestInfos() {
  let summaryData = {};

  console.log("Processing old data");
  convertPreArtifactData.process();

  console.log("Fetching test spreadsheet to figure out what to ignore");
  let testMetadata = await getTestMetadata();

  console.log("First, importing data from before taskcluster artifacts");
  let items = fs.readdirSync("cache/imported-from-before-artifacts");
  for (let item of items) {
    if (item.endsWith("json")) {
      let date = item.split(".")[0];
      let text = fs.readFileSync(
        `cache/imported-from-before-artifacts/${item}`,
        "utf8"
      );
      summaryData[date] = JSON.parse(text);
    }
  }

  console.log("Next, importing daily data from taskcluster artifacts");

  let testsPerDay = {};
  // const url = "https://index.taskcluster.net/v1/task/gecko.v2.mozilla-central.latest.source.test-info-fission/artifacts/public/test-info-fission.json";
  for (let date of getDatesBetween(new Date(2019, 08, 19), new Date())) {
    // YYYY-MM-DD
    var dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
    console.log("Fetching", dateString);

    // YYYY.MM.DD
    let tcDate = dateString.replace(new RegExp("-", "g"), ".");
    let url = `https://index.taskcluster.net/v1/task/gecko.v2.mozilla-central.pushdate.${tcDate}.latest.source.test-info-fission/artifacts/public/test-info-fission.json`;

    let response = await fetch(url);
    let obj = await response.json();

    let todaySet = (testsPerDay[dateString] = new Set());
    for (let component in obj.tests) {
      if (shouldIgnoreComponent(component)) {
        continue;
      }
      let lengthBeforeFilter = obj.tests[component].length;
      obj.tests[component] = obj.tests[component].filter(obj => {
        // obj looks like:
        /*
        { 'skip-if':
            'fission || os == \'linux\' || (os == \'mac\' && debug) || (debug && os == \'win\' && bits == 64)',
          test:
              'browser/components/extensions/test/browser/browser_ext_devtools_network.js'
        }
        */
        if (todaySet.has(obj.test)) {
          // WebExtensions tests are weird.
          // They're registered from 2 separate manifests to run in 2 configurations.
          // For instance: https://github.com/bgrins/arewefissionyet/blob/4e337027ae913341d8a3b4758151f7c6d0c7fb25/cache/test-info-fission/2019-10-10.json#L1667-L1676.
          // When this happens just skip it.
          console.log(
            `Skipping duplicate entry (should be in WebExtensions). component ${component} path: ${obj.test}`
          );
          return;
        }

        if (!testMetadata.has(obj.test)) {
          console.error(
            "Found a test with no metadata from the sheet:",
            obj.test
          );
        }

        let inM4 = testMetadata.get(obj.test) == "M4";
        if (inM4) {
          todaySet.add(obj.test);
        }

        return inM4;
      });
      let lengthAfterFilter = obj.tests[component].length;

      if (lengthBeforeFilter != lengthAfterFilter) {
        console.log(
          "Component was filtered (non-M4 or duplicate entries)",
          component,
          lengthBeforeFilter,
          lengthAfterFilter
        );
      }
    }

    summaryData[dateString] = obj;
    let fileName = `cache/test-info-fission/${dateString}.json`;
    fs.writeFileSync(fileName, JSON.stringify(obj, null, 2));
  }
  fs.writeFileSync(
    "skipped-failing-tests/all.json",
    JSON.stringify(summaryData, null, 2)
  );

  makeTimeline(testsPerDay);
}

function makeTimeline(testsPerDay) {
  // First, build up an object like:
  // { 2019-10-01: { additions: [ 'dom/push/test/test_permissions.html' ],
  //                 removals: [ 'dom/security/test/csp/test_upgrade_insecure.html' ]
  // }
  let changesPerDay = {};
  let yesterdaySet;
  for (let date in testsPerDay) {
    let todaySet = testsPerDay[date];
    if (yesterdaySet) {
      changesPerDay[date] = {};
      changesPerDay[date].removals = new Set(
        [...yesterdaySet].filter(x => !todaySet.has(x))
      );
      changesPerDay[date].additions = new Set(
        [...todaySet].filter(x => !yesterdaySet.has(x))
      );
      changesPerDay[date].remaining = todaySet.size;

      console.log(
        "Difference of sets:",
        date,
        [...changesPerDay[date].additions],
        [...changesPerDay[date].removals]
      );
    }
    yesterdaySet = todaySet;
  }

  const TIMELINE_HTML_PATH = "./m4/timeline/index.html";
  var text = fs.readFileSync(TIMELINE_HTML_PATH, "utf8");
  var newText =
    text.split("<!-- REPLACE-TIMELINE -->")[0] + "<!-- REPLACE-TIMELINE -->\n";

  let reversedDays = reverseObject(changesPerDay);
  let detailsShouldBeOpened = true;
  for (let date in reversedDays) {
    let currentAdditions = changesPerDay[date].additions;
    let currentRemovals = changesPerDay[date].removals;
    let hasChanges = currentAdditions.size || currentRemovals.size;
    if (hasChanges) {
      newText += `<details class="cd-details" ${detailsShouldBeOpened ? "open" : ""}><summary><h2>${date}: ${
        currentRemovals.size
      } tests fixed ${
        currentAdditions.size
          ? "and " + currentAdditions.size + " new tests to fix"
          : ""
      } (${changesPerDay[date].remaining} remaining)</h2></summary>
      <div class="cd-timeline">`;
    }

    // TODO: fetch metadata (bug # and assignees)
    for (let addition of changesPerDay[date].additions) {
      newText += getMarkupForTimelineEntry(true, date, addition);
    }
    for (let removal of changesPerDay[date].removals) {
      newText += getMarkupForTimelineEntry(false, date, removal);
    }
    if (hasChanges) {
      newText += `</div></details>`;
    }

    // Only leave the most recent day opened
    detailsShouldBeOpened = false;
  }

  newText +=
    "\n<!-- END-REPLACE-TIMELINE -->" +
    text.split("<!-- END-REPLACE-TIMELINE -->")[1];
  fs.writeFileSync(TIMELINE_HTML_PATH, newText);

  // console.log(`Finished processing. We have metadata for ${totalMetadata} bindings, and ${metadataSeen} of them have been removed. So we know of ${totalMetadata - metadataSeen} still in progress.`);
}

fetchTestInfos();

function reverseObject(object) {
  var newObject = {};
  var keys = [];

  for (var key in object) {
    keys.push(key);
  }

  for (var i = keys.length - 1; i >= 0; i--) {
    var value = object[keys[i]];
    newObject[keys[i]] = value;
  }

  return newObject;
}

function getMarkupForTimelineEntry(added, date, name, metadata) {
  metadata = metadata || {};
  var link =
    metadata.bug &&
    `<small><a href='${metadata.bug}'>bug ${
      metadata.bug.match(/\d+$/)[0]
    }</a></small>`;
  var type = (metadata.type && `<small>${metadata.type}</small>`) || "";
  var assignee =
    (metadata.assignee && `<small>${metadata.assignee}</small>`) || "";
  var metadata =
    (metadata.bug &&
      `<span style='float: right'>${assignee} ${type} ${link}</span>`) ||
    "";
  return `
  <div class="cd-timeline-block">
    <div class="cd-timeline-img cd-${added ? "addition" : "subtraction"}">
    </div>

    <div class="cd-timeline-content">
      <h2>
        <small>${
    added ? "New failing test" : "Fixed"
  }</small>${name}
        ${metadata}
      </h2>
    </div>
  </div>`;
}
