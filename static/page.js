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

async function fetchSampleData() {
  let r = await fetch("./skipped-failing-tests/sample-data-from-sheet.csv");
  let text = await r.text();
  let data = text.split("\n");
  data.shift(); // remove header
  return data;
}

async function renderCharts(data) {
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
    markers: markers,
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
  let data = await fetchSampleData();
  await renderCharts(data);
});
