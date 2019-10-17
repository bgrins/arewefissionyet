var fs = require("fs");
const fetch = require("node-fetch");
const convertPreArtifactData = require("./convert-csv-to-json");

const TIMELINE_DATA_SOURCE_PATH = `./cache/m4-timeline.json`;
const TIMELINE_HTML_PATH = "./m4/timeline/index.html";

if (!fs.existsSync("cache")) {
  fs.mkdirSync("cache");
}
if (!fs.existsSync("cache/test-info-fission")) {
  fs.mkdirSync("cache/test-info-fission");
}

async function run() {
  console.log("Fetching test spreadsheet to figure out what to ignore");
  const testMetadata = await getTestMetadata();

  console.log("Fetching artifacts");
  const testsPerDay = await fetchTestInfos(testMetadata);

  saveTimelineData(testsPerDay, testMetadata);
  renderTimeline();
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

// Returns an array of dates between the two dates
function getDatesBetween(startDate, endDate) {
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
}

async function getTestMetadata() {
  // let bugToAssignees = {};
  // let assignees = await request("https://docs.google.com/spreadsheets/d/e/2PACX-1vSBOysww1PcGcB19Ew_NOUpPnQMGkP1RQGAOAoYMRvgVMWWhmcdjyOfLjvEDCC_F6nobE7Hu6ooaj7Q/pub?gid=1164074255&single=true&output=csv");
  // for (let row of assignees.split("\n")) {
  //   let cols = row.split(",");
  //   if (cols[1] && cols[2]) {
  //     bugToAssignees["https://bugzilla.mozilla.org/show_bug.cgi?id=" + cols[1]] = cols[2].trim();
  //   }
  // }

  const testMetadata = new Map();
  let response = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRmnRUOy-KDDScK8o8Z6aKRaEtXKXb39Yn2OOPXoMgZwcMC3Oce3jgSjI5-jRK0jLS73gQYLkfSTJ_/pub?gid=1560718888&single=true&output=csv"
  );
  let obj = await response.text();

  let rows = obj.split("\n");
  let testPathPosition = rows[0].split(",").indexOf("Test");
  let bugIDPosition = rows[0].split(",").indexOf("Bug ID");
  let milestoneColPosition = rows[0].split(",").indexOf("Fission Target");
  if (!testPathPosition || !milestoneColPosition || !bugIDPosition) {
    throw new Error(
      `Fission spreadsheet doesn't have column for test (${testPathPosition}) or milestone: ${milestoneColPosition}`
    );
  }

  let bugsToFetchAssignees = new Set();
  for (let row of rows.slice(1)) {
    let cols = row.split(",");
    let bugID = cols[bugIDPosition];
    if (bugID && !isNaN(bugID)) {
      bugsToFetchAssignees.add(bugID);
    }
  }

  let bugList = [...bugsToFetchAssignees].join(",");
  let bugzillaSearchURL = `https://bugzilla.mozilla.org/buglist.cgi?bug_id=${bugList}&bug_id_type=anyexact&columnlist=assigned_to&query_format=advanced&ctype=csv&human=1`;

  console.log("Fetching assignee data from bugzilla", bugzillaSearchURL);
  let assigneeResponse = await fetch(bugzillaSearchURL);
  let assigneeObj = await assigneeResponse.text();

  let bugToAssignees = {};
  for (let row of assigneeObj.split("\n").slice(1)) {
    let cols = row.split(",");
    if (cols[0] && cols[1]) {
      bugToAssignees[
        "https://bugzilla.mozilla.org/show_bug.cgi?id=" + cols[0]
      ] = cols[1].trim().replace(/^"(.*)"$/, "$1");
    }
  }

  for (let row of rows.slice(1)) {
    let cols = row.split(",");
    let testPath = cols[testPathPosition];
    let milestone = cols[milestoneColPosition];
    let bugID = isNaN(cols[bugIDPosition]) ? null : cols[bugIDPosition];
    let bug = bugID
      ? `https://bugzilla.mozilla.org/show_bug.cgi?id=${bugID}`
      : undefined;
    let assignee = bug ? bugToAssignees[bug] : null;
    testMetadata.set(testPath, {
      milestone,
      bug,
      assignee
    });
  }

  return testMetadata;
}

async function fetchTestInfos(testMetadata) {
  let summaryData = {};

  console.log("Processing old data");
  convertPreArtifactData.process();

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
          if (component != "WebExtensions::General")
            console.error(
              `Skipping duplicate entry (only WebExtensions should do this). component ${component} path: ${obj.test}`
            );
          return;
        }

        let metadata = testMetadata.get(obj.test);
        if (!metadata) {
          console.error(
            "Error: found a test with no metadata from the sheet:",
            obj.test
          );
        }

        if (metadata) {
          metadata.component = component;
        }

        let inM4 = metadata && metadata.milestone == "M4";
        if (inM4) {
          todaySet.add(obj.test);
        }

        return inM4;
      });
      let lengthAfterFilter = obj.tests[component].length;

      if (lengthBeforeFilter != lengthAfterFilter) {
        console.log(
          `Component was filtered (non-M4 or duplicate entries): ${component} ${lengthBeforeFilter} -> ${lengthAfterFilter}`
        );
      }
    }

    summaryData[dateString] = obj;
    let fileName = `cache/test-info-fission/${dateString}.json`;
    fs.writeFileSync(fileName, JSON.stringify(obj, null, 2));
  }
  fs.writeFileSync("cache/m4.json", JSON.stringify(summaryData, null, 2));

  return testsPerDay;
}

function saveTimelineData(testsPerDay, testMetadata) {
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

      // console.log(
      //   "Difference of sets:",
      //   date,
      //   [...changesPerDay[date].additions],
      //   [...changesPerDay[date].removals]
      // );
    }
    yesterdaySet = todaySet;
  }

  let changesPerDaySerialized = {};
  for (let date in changesPerDay) {
    changesPerDaySerialized[date] = {
      removals: [...changesPerDay[date].removals].map(test => ({
        path: test,
        metadata: testMetadata.get(test)
      })),
      additions: [...changesPerDay[date].additions].map(test => ({
        path: test,
        metadata: testMetadata.get(test)
      })),
      remaining: changesPerDay[date].remaining
    };
  }

  // Reverse so that we render from newest to oldest:
  changesPerDaySerialized = reverseObject(changesPerDaySerialized);

  // Loop through them and write new timestamp if changed
  let previousChangesPerDay = JSON.parse(
    fs.readFileSync(TIMELINE_DATA_SOURCE_PATH, "utf8")
  );

  let newUpdateTime = Date.now();
  for (let day in changesPerDaySerialized) {
    if (!previousChangesPerDay[day]) {
      changesPerDaySerialized[day].lastUpdated = newUpdateTime;
      continue;
    }

    let previousUpdateTime = previousChangesPerDay[day].lastUpdated;
    delete previousChangesPerDay[day].lastUpdated;
    let unchanged =
      JSON.stringify(changesPerDaySerialized[day]) ==
      JSON.stringify(previousChangesPerDay[day]);
    changesPerDaySerialized[day].lastUpdated = unchanged
      ? previousUpdateTime
      : newUpdateTime;
  }

  fs.writeFileSync(
    TIMELINE_DATA_SOURCE_PATH,
    JSON.stringify(changesPerDaySerialized, null, 2)
  );
}

function renderTimeline() {
  let timelineData = JSON.parse(
    fs.readFileSync(TIMELINE_DATA_SOURCE_PATH, "utf8")
  );

  var text = fs.readFileSync(TIMELINE_HTML_PATH, "utf8");
  var newText =
    text.split("<!-- REPLACE-TIMELINE -->")[0] + "<!-- REPLACE-TIMELINE -->\n";

  let detailsShouldBeOpened = true;
  for (let date in timelineData) {
    let currentAdditions = timelineData[date].additions;
    let currentRemovals = timelineData[date].removals;
    let hasChanges = currentAdditions.length || currentRemovals.length;
    if (hasChanges) {
      let dateParts = date.split("-");
      let dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      newText += `<details class="arewe-timeline-details" ${
        detailsShouldBeOpened ? "open" : ""
      }><summary><h2>${date} (${new Intl.DateTimeFormat("en-US", {
        weekday: "long"
      }).format(dateObj)}): ${currentRemovals.length} tests fixed ${
        currentAdditions.length
          ? "and " + currentAdditions.length + " new tests to fix"
          : ""
      } (${timelineData[date].remaining} remaining)</h2></summary>
      <div class="arewe-timeline">`;
    }

    // TODO: fetch metadata (bug # and assignees)
    for (let addition of timelineData[date].additions) {
      newText += getMarkupForTimelineEntry(addition, true);
    }
    for (let removal of timelineData[date].removals) {
      newText += getMarkupForTimelineEntry(removal, false);
    }
    if (hasChanges) {
      newText += `</div></details>`;
    }

    // Only leave the most recent day opened
    // detailsShouldBeOpened = false;
  }

  newText +=
    "\n<!-- END-REPLACE-TIMELINE -->" +
    text.split("<!-- END-REPLACE-TIMELINE -->")[1];
  fs.writeFileSync(TIMELINE_HTML_PATH, newText);
}

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

function getMarkupForTimelineEntry(change, isAdded) {
  var metadata = change.metadata || {};
  var link = metadata.bug
    ? `<small><a href='${metadata.bug}'>bug ${
        metadata.bug.match(/\d+$/)[0]
      }</a></small>`
    : "";
  var badge = isAdded ? `<small>New failing test</small>` : "";
  var name = `<span title="${
    change.path
  }" class="arewe-timeline-path">${change.path
    .split("/")
    .shift()}/…/${change.path.split("/").pop()}</span>`;
  // var type = (metadata.type && `<small>${metadata.type}</small>`) || "";
  var assignee =
    (metadata.assignee && `<small>${metadata.assignee}</small>`) || "";
  var component =
    (metadata.component && `<small>${metadata.component}</small>`) || "";
  return `
  <div class="arewe-timeline-block">
    <div class="arewe-timeline-img arewe-${
      isAdded ? "addition" : "subtraction"
    }">
    </div>
    <div class="arewe-timeline-content">
      <h2>
        ${name}
      </h2>
      <span style="float: right;">${badge}${component}${assignee}${link}</span>
    </div>
  </div>`;
}

run();
