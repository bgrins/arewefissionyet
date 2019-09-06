
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

async function fetchTestInfos() {
  let summaryData = {};


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
  const url = "https://index.taskcluster.net/v1/task/gecko.v2.mozilla-central.latest.source.test-info-fission/artifacts/public/test-info-fission.json";
  for (let date of getDatesBetween(new Date(2019,08,05), new Date())) {
    // YYYY-MM-DD
    var dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 ))
                              .toISOString()
                              .split("T")[0];
    let fileName = `cache/test-info-fission/${dateString}.json`
    let response = await fetch(url);
    let obj = await response.json();

    summaryData[dateString] = obj;
    fs.writeFileSync(fileName, JSON.stringify(obj));
  }
  fs.writeFileSync('skipped-failing-tests/all.json', JSON.stringify(summaryData));
}

fetchTestInfos();
