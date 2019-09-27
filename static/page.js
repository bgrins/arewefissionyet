const IN_PREVIEW = new URLSearchParams(window.location.search).has("preview");

if (IN_PREVIEW) {
  document.querySelector("#table-container").style.display = "none";
  document.querySelector("h1").style.display = "none";
  console.log("in preview");
}

async function getComponentLinks() {
  let response = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRmnRUOy-KDDScK8o8Z6aKRaEtXKXb39Yn2OOPXoMgZwcMC3Oce3jgSjI5-jRK0jLS73gQYLkfSTJ_/pub?gid=2031736766&single=true&output=csv"
  );
  let text = await response.text();
  // TODO: Convert this into a map from compnent id => link
  console.log(text);
}
getComponentLinks();

// https://github.com/FirefoxUX/photon-colors/blob/master/photon-colors.json
window.photonColors = [
  {
    // "blue"
    50: "#0a84ff",
    60: "#0060df",
    70: "#003eaa",
    80: "#002275",
    90: "#000f40"
  },
  {
    // "red"
    50: "#ff0039",
    60: "#d70022",
    70: "#a4000f",
    80: "#5a0002",
    90: "#3e0200"
  },
  {
    // "purple"
    50: "#9400ff",
    60: "#8000d7",
    70: "#6200a4",
    80: "#440071",
    90: "#25003e"
  },
  {
    // "teal"
    50: "#00feff",
    60: "#00c8d7",
    70: "#008ea4",
    80: "#005a71",
    90: "#002d3e"
  },
  {
    // "orange"
    50: "#ff9400",
    60: "#d76e00",
    70: "#a44900",
    80: "#712b00",
    90: "#3e1300"
  },
  // { // "grey"
  //   50: "#737373", 60: "#4a4a4f", 70: "#38383d", 80: "#2a2a2e", 90: "#0c0c0d", },
  // { // "ink"
  //   50: "#595E91", 60: "#464B76", 70: "#363959", 80: "#202340", 90: "#0f1126", },
  {
    // "green"
    50: "#30e60b",
    60: "#12bc00",
    70: "#058b00",
    80: "#006504",
    90: "#003706"
  },
  {
    // "magenta"
    50: "#ff1ad9",
    60: "#ed00b5",
    70: "#b5007f",
    80: "#7d004f",
    90: "#440027"
  },
  {
    // "yellow"
    50: "#ffe900",
    60: "#d7b600",
    70: "#a47f00",
    80: "#715100",
    90: "#3e2800"
  }
];

let currentColorIndex = 0;
let currentColorShadeIndex = 0;
let currentColorShades = [50, 90, 70, 80, 60];
function getNextColor() {
  if (currentColorIndex == photonColors.length) {
    currentColorIndex = 0;
  }
  if (currentColorShadeIndex == currentColorShades.length) {
    currentColorShadeIndex = 0;
  }
  let color =
    photonColors[currentColorIndex][currentColorShades[currentColorShadeIndex]];
  console.log(color);
  currentColorIndex++;
  currentColorShadeIndex++;
  return color;
}

async function fetchDataJSON() {
  let r = await fetch("../skipped-failing-tests/all.json");
  let obj = await r.json();
  return obj;
}

function shouldIgnoreComponent(component) {
  let ignoredComponents = [
    "Core::Privacy: Anti-Tracking",
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

document.addEventListener("DOMContentLoaded", async function ready() {
  let data = await fetchDataJSON();
  window.DAILY_DATA = [];
  window.COMPONENT_DATA = {};

  // Home page: mini version of the chart, and links to other stuff
  // Fix colors
  // Meta redirect in awfy/sheet with meta -> potentially redirect to the right component

  for (let date in data) {
    let currentDay = data[date];
    currentDay.totalTests = 0;
    for (let component in currentDay.tests) {
      if (shouldIgnoreComponent(component)) {
        continue;
      }

      // console.log(component, currentDay.tests[component].length);
      COMPONENT_DATA[component] = COMPONENT_DATA[component] || {};
      COMPONENT_DATA[component][date] = currentDay.tests[component].length;
      currentDay.totalTests += currentDay.tests[component].length;
    }

    DAILY_DATA.push(currentDay);

    let sortedComponents = (currentDay.sortedComponents = []);
    for (let component in currentDay.tests) {
      if (shouldIgnoreComponent(component)) {
        continue;
      }
      sortedComponents.push({
        component,
        tests: currentDay.tests[component].length
      });
      // console.log(`${component}: ${componentTests.length}`)
    }
    sortedComponents = sortedComponents.sort((a, b) => {
      return a.tests < b.tests;
    });
  }

  let lastDay = DAILY_DATA[DAILY_DATA.length - 1];
  document.querySelector(
    "h1"
  ).textContent += `: ${lastDay.totalTests} Tests Remain`;
  document.querySelector("#table").innerHTML = lastDay.sortedComponents
    .map((c, i) => {
      return `<tr><td><input type="checkbox" ${i <= 20 ? "checked" : ""} />${
        c.component
      }</td><td>${c.tests}</td>`;
    })
    .join("");
  document
    .querySelector("#table")
    .addEventListener("change", buildStackedGraph);

  buildStackedGraph();
});

function buildStackedGraph() {
  // TODO:
  // - Filter out DevTools data
  // - Filter out tests that aren't actually skpped / failing
  console.log(DAILY_DATA, COMPONENT_DATA);
  currentColorIndex = currentColorShadeIndex = 0;

  let days = [];
  for (let day in COMPONENT_DATA["Core::DOM: Core & HTML"]) {
    days.push(day);
  }

  let lastDay = DAILY_DATA[DAILY_DATA.length - 1];
  let datasets = [];

  let otherComponents = [
    ...document.querySelectorAll("input:not(:checked)")
  ].map(el => el.nextSibling.data);
  let otherComponentData = [];
  let firstRun = true;
  for (let component of otherComponents) {
    let data = [];
    let i = 0;
    for (let days in COMPONENT_DATA[component]) {
      if (firstRun) {
        otherComponentData.push(COMPONENT_DATA[component][days]);
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
      data: otherComponentData
    });
  }

  // let topComponents = DAILY_DATA[0].sortedComponents.slice(0, 2).map(c=>c.component);
  let topComponents = [...document.querySelectorAll("input:checked")].map(
    el => el.nextSibling.data
  ); // ["Core::DOM: Core & HTML"];
  console.log(topComponents);

  for (let component of topComponents) {
    let data = [];
    for (let days in COMPONENT_DATA[component]) {
      data.push(COMPONENT_DATA[component][days]);
    }
    let color = getNextColor();
    datasets.push({
      label: component,
      backgroundColor: color,
      borderColor: color,
      data
    });
  }

  if (window.myChart) {
    window.myChart.data.datasets = datasets;
    window.myChart.update();
  } else {
    let ctx = document
      .getElementById("component-specific-tests")
      .getContext("2d");

    let chartOptions = {
      type: "line",
      data: {
        labels: days,
        datasets: datasets
      },
      options: {
        tooltips: {
          mode: "index"
        },
        hover: {
          mode: "index"
        },
        scales: {
          xAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: "Date"
              }
            }
          ],
          yAxes: [
            {
              stacked: true,
              scaleLabel: {
                display: true,
                labelString: "Number of broken tests"
              }
            }
          ]
        }
      }
    };

    if (IN_PREVIEW) {
      chartOptions.options.title = {
        display: true,
        text: "Milestone 4"
      };

      chartOptions.options.legend = {
          display: false
      };
    }

    window.myChart = new Chart(ctx, chartOptions);
  }
}
