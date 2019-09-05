var markers = [
  {
    date: new Date("2019-08-07"),
    label: "1st Milestone"
  },
  {
    date: new Date("2019-08-24"),
    label: "2nd Milestone"
  }
];

function convertJSONForChart(data) {
  // XXX: Clone because we are reusing the same object for stub data
  data = JSON.parse(JSON.stringify(data));
  console.log(data);
  // return data;
  let skippedValues = [];
  let skippedChartData = [skippedValues];
  let failingValues = [];
  let failingChartData = [failingValues];
  let allChartData = [skippedValues, failingValues];
  for (let date in data) {
    console.log(data[date])
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
    skippedChartData,
    failingChartData,
  }

}
async function fetchSampleDataJSON() {
  let r = await fetch("./skipped-failing-tests/all.json");
  let obj = await r.json();
  return convertJSONForChart(obj)
}

function convertCSVForChart(data) {
  let skippedValues = [];
  let skippedChartData = [skippedValues];
  let failingValues = [];
  let failingChartData = [failingValues];
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
    skippedChartData,
    failingChartData,
  }
}

async function fetchSampleDataCSV() {
  let r = await fetch("./skipped-failing-tests/sample-data-from-sheet.csv");
  let text = await r.text();
  let data = text.split("\n");
  data.shift(); // remove header
  return convertCSVForChart(data);
}

async function renderCharts({skippedChartData,failingChartData,allChartData}) {
  MG.data_graphic({
    title: "Skipped and Failing Tests",
    data: allChartData,
    full_width: true,
    full_height: true,
    right: 100,
    interpolate: d3.curveLinear,
    target: "#skipped-and-failing-tests",
    legend: ["Skipped Tests", "Failing Tests"]
  });
  MG.data_graphic({
    title: "Skipped Tests",
    data: skippedChartData,
    markers: markers,
    full_width: true,
    full_height: true,
    // height: 300,
    // right: 100,
    interpolate: d3.curveLinear,
    target: "#skipped-tests"
    // legend: ['Skipped Tests'],
  });
  MG.data_graphic({
    title: "Failing Tests",
    data: failingChartData,
    full_width: true,
    full_height: true,
    // height: 300,
    // right: 100,
    interpolate: d3.curveLinear,
    target: "#failing-tests"
    // legend: ['Failing Tests'],
  });
}

document.addEventListener("DOMContentLoaded", async function ready() {
  // let data = await fetchSampleDataCSV();
  let data = await fetchSampleDataCSV();
  await renderCharts(data);
});
