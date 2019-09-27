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

async function renderCharts({allChartData}) {
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
  window.DAILY_DATA = [];
  window.COMPONENT_DATA = {};

  for (let date in data) {
    let currentDay = data[date];
    for (let component in currentDay.tests) {
      // console.log(component, currentDay.tests[component].length);
      COMPONENT_DATA[component] = COMPONENT_DATA[component] || {};
      COMPONENT_DATA[component][date] = currentDay.tests[component].length;
    }
    DAILY_DATA.push(currentDay);

    let sortedComponents = currentDay.sortedComponents = [];
    for (let component in currentDay.tests) {
      // let componentTests = currentDay.tests[component];
      sortedComponents.push({ component, tests: currentDay.tests[component].length });
      // console.log(`${component}: ${componentTests.length}`)
    }
    sortedComponents = sortedComponents.sort((a, b) => {
      return a.tests < b.tests;
    });
  }

  let lastDay = DAILY_DATA[DAILY_DATA.length - 1];
  let numTestsThatNeedAddressing = lastDay.summary["skipped tests"] +
                                   lastDay.summary["failed tests"];
  document.querySelector("h1").textContent = numTestsThatNeedAddressing + " " + document.querySelector("h1").textContent ;
  document.querySelector("#table").innerHTML = lastDay.sortedComponents.map((c, i) => {
    return `<tr><td><input type="checkbox" ${i<=8 ? "checked" : ""} />${c.component}</td><td>${c.tests}</td>`;
  }).join("");
  document.querySelector("#table").addEventListener("change", buildStackedGraph);

  // await renderCharts(convertJSONForChart(data));
  buildStackedGraph()
});

// https://github.com/FirefoxUX/photon-colors/blob/master/photon-colors.json
window.photonColors = [
  { //"blue": {
    40: "#45a1ff",
    50: "#0a84ff",
    60: "#0060df",
    70: "#003eaa",
    80: "#002275",
    90: "#000f40"
  },
  { //"magenta":
    50: "#ff1ad9",
    60: "#ed00b5",
    70: "#b5007f",
    80: "#7d004f",
    90: "#440027"
  },
  { //"purple": {
    50: "#9400ff",
    60: "#8000d7",
    70: "#6200a4",
    80: "#440071",
    90: "#25003e"
  },
  { //"teal": {
    50: "#00feff",
    60: "#00c8d7",
    70: "#008ea4",
    80: "#005a71",
    90: "#002d3e"
  },
  { //"green": {
    50: "#30e60b",
    60: "#12bc00",
    70: "#058b00",
    80: "#006504",
    90: "#003706"
  },
  { //"yellow": {
    50: "#ffe900",
    60: "#d7b600",
    70: "#a47f00",
    80: "#715100",
    90: "#3e2800"
  },
  { //"red": {
    50: "#ff0039",
    60: "#d70022",
    70: "#a4000f",
    80: "#5a0002",
    90: "#3e0200"
  },
  { // "orange": {
    50: "#ff9400",
    60: "#d76e00",
    70: "#a44900",
    80: "#712b00",
    90: "#3e1300"
  },
  { //"grey": {
    50: "#737373",
    60: "#4a4a4f",
    70: "#38383d",
    80: "#2a2a2e",
    90: "#0c0c0d",
  },
  { //"ink": {
    50: "#595E91",
    60: "#464B76",
    70: "#363959",
    80: "#202340",
    90: "#0f1126"
  },
];
let currentColorIndex = 0;
let currentColorShadeIndex = 60;
function getNextColor() {
  if (currentColorIndex == photonColors.length) {
    currentColorIndex = 0;
  }
  if (currentColorShadeIndex == 100) {
    currentColorShadeIndex = 50;
  }
  let color = photonColors[currentColorIndex][currentColorShadeIndex];

  currentColorIndex++;
  currentColorShadeIndex += 10;
  return color;
}

function buildStackedGraph() {
  // TODO:
  // - Filter out DevTools data
  // - Filter out tests that aren't actually skpped / failing
  console.log(DAILY_DATA, COMPONENT_DATA);

  let days = [];
  for (let day in COMPONENT_DATA["Core::DOM: Core & HTML"]) {
    days.push(day);
  }

  let lastDay = DAILY_DATA[DAILY_DATA.length - 1]
  let datasets = [];

  let otherComponents = [...document.querySelectorAll("input:not(:checked)")].map(el=>el.nextSibling.data);
  let otherComponentData = [];
  let firstRun = true;
  for (let component of otherComponents) {
    let data = [];
    let i = 0;
    for (let days in COMPONENT_DATA[component]) {
      if (firstRun) {
        otherComponentData.push(COMPONENT_DATA[component][days])
      } else {
        otherComponentData[i] += COMPONENT_DATA[component][days];
      }
      i++;
    }

    firstRun = false;
  }

  if (otherComponents.length) {
    let color = getNextColor();
    datasets.push({
      label: `Others (${otherComponents.length})`,
      backgroundColor: color,
      borderColor: color,
      data: otherComponentData,
    });
  }

  // let topComponents = DAILY_DATA[0].sortedComponents.slice(0, 2).map(c=>c.component);
  let topComponents = [...document.querySelectorAll("input:checked")].map(el=>el.nextSibling.data); // ["Core::DOM: Core & HTML"];
  console.log(topComponents);

  for (let component of topComponents) {
    let data = [];
    for (let days in COMPONENT_DATA[component]) {
      data.push(COMPONENT_DATA[component][days])
    }
    let color = getNextColor();
    datasets.push({
      label: component,
      backgroundColor: color,
      borderColor: color,
      data
    });
  }

  // console.log(otherComponentData)
  // for (let i = 0; i < 8; i++) {
  //   // for (let j = 0; j < DAILY_DATA.length; j++) {
  //   //   DAILY_DATA[j].tests[]
  //   // }
  //   let COMPONENT_DATA = lastDay.sortedComponents[i];
  //   datasets.push({
  //     label: COMPONENT_DATA.component,
  //     // borderColor: window.chartColors.red,
  //     // backgroundColor: window.chartColors.red,
  //     data: [
  //       1,
  //       2,
  //       3,
  //       4,
  //       5,
  //       6,
  //       7
  //     ],
  //   });
  // }
  let ctx = document.getElementById('component-specific-tests').getContext('2d');
  var myChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: days,
          datasets: datasets,
        },
        options: {
          responsive: true,
          // title: {
          // 	display: true,
          // 	text: 'Chart.js Line Chart - Stacked Area'
          // },
          tooltips: {
            mode: 'index',
          },
          hover: {
            mode: 'index'
          },
          scales: {
            xAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'Date'
              }
            }],
            yAxes: [{
              stacked: true,
              scaleLabel: {
                display: true,
                labelString: 'Number of tests'
              }
            }]
          }
        }
  });
}
