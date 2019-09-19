var markers = [
  // {
  //   date: new Date("2019-08-07"),
  //   label: "1st Milestone"
  // },
  // {
  //   date: new Date("2019-08-24"),
  //   label: "2nd Milestone"
  // }
];

function convertJSONForChart(data) {
  let skippedValues = [];
  let failingValues = [];
  let allChartData = [skippedValues, failingValues];
  for (let date in data) {
    let skipped = data[date].summary["skipped tests"];
    let failed = data[date].summary["failed tests"];
    skippedValues.push({
      date: new Date(date),
      value: parseInt(skipped)
    });
    failingValues.push({
      date: new Date(date),
      value: parseInt(failed)
    });
  }

  return {
    allChartData,
  }

}
async function fetchDataJSON() {
  let r = await fetch("./skipped-failing-tests/all.json");
  let obj = await r.json();
  return obj;
}

function convertCSVForChart(data) {
  let skippedValues = [];
  let failingValues = [];
  let allChartData = [skippedValues, failingValues];
  for (let row of data) {
    let vals = row.split(",");
    let date = vals[1];
    let skipped = vals[2];
    let failed = vals[4];
    skippedValues.push({
      date: new Date(date),
      value: parseInt(skipped)
    });
    failingValues.push({
      date: new Date(date),
      value: parseInt(failed)
    });
  }

  return {
    allChartData,
  }
}

async function fetchSampleDataCSV() {
  let r = await fetch("./skipped-failing-tests/sample-data-from-sheet.csv");
  let text = await r.text();
  let data = text.split("\n");
  data.shift(); // remove header
  return convertCSVForChart(data);
}

async function renderCharts({allChartData}, numTestsThatNeedAddressing) {
  MG.data_graphic({
    // title: `${numTestsThatNeedAddressing} Tests Need to be Fixed For Fission`,
    data: allChartData,
    full_width: true,
    // full_height: true,
    height: window.innerHeight * .75,
    right: 100,
    interpolate: d3.curveLinear,
    target: "#skipped-and-failing-tests",
    legend: ["Skipped Tests", "Failing Tests"]
  });
}

document.addEventListener("DOMContentLoaded", async function ready() {
  let data = await fetchDataJSON();
  // let data = await fetchSampleDataCSV();
  let lastDay;
  for (let date in data) {
    lastDay = data[date];
  }

  let sortedComponents = [];
  let numTestsThatNeedAddressing = lastDay.summary["skipped tests"] +
                                   lastDay.summary["failed tests"];
  document.querySelector("h1").textContent = numTestsThatNeedAddressing + " " + document.querySelector("h1").textContent ;

  for (let component in lastDay.tests) {
    let componentTests = lastDay.tests[component];
    sortedComponents.push({ component, tests: lastDay.tests[component] });
    console.log(`${component}: ${componentTests.length}`)
  }

  sortedComponents = sortedComponents.sort((a, b) => {
    return a.tests.length < b.tests.length;
  });
  console.log(sortedComponents);




  await renderCharts(convertJSONForChart(data), numTestsThatNeedAddressing);

  document.querySelector("#table").innerHTML = sortedComponents.map(c => {
    return `<tr><td>${c.component}</td><td>${c.tests.length}</td>`;
  }).join("");
});
