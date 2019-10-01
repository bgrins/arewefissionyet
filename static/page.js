const IN_PREVIEW = new URLSearchParams(window.location.search).has("preview");
const COMPONENT_LINK_TO_SPREADSHEET_MAP = {};
const NUM_COMPONENTS_IN_DEFAULT = 16;
const DAILY_DATA = [];
const COMPONENT_DATA = {};

if (IN_PREVIEW) {
  document.documentElement.classList.add("compact");
}

async function fetchComponentLinks() {
  let response = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRmnRUOy-KDDScK8o8Z6aKRaEtXKXb39Yn2OOPXoMgZwcMC3Oce3jgSjI5-jRK0jLS73gQYLkfSTJ_/pub?gid=2031736766&single=true&output=csv"
  );
  let text = await response.text();
  for (let row of text.split("\n")) {
    let cols = row.split(",");
    COMPONENT_LINK_TO_SPREADSHEET_MAP[cols[0]] = cols[1];
  }
}

Chart.defaults.global.defaultFontFamily = "Fira Sans";
Chart.defaults.global.defaultFontWeight = "300";

// Provide a position that's fixed to the top of the chart and aligns with
// mouse X. This isn't used right now.
Chart.Tooltip.positioners.fixed = function(elements, eventPosition) {
  /** @type {Chart.Tooltip} */
  var tooltip = this;
  return {
    x: tooltip._eventPosition.x,
    y: tooltip._chart.chartArea.top
  };
};

let componentLinksReady = fetchComponentLinks();

// https://github.com/FirefoxUX/photon-colors/blob/master/photon-colors.json
window.photonColors = [
  {
    // "blue"
    50: "#0a84ff",
    60: "#0060df",
    70: "#003eaa",
    80: "#002275",
    90: "#333f80" // "#000f40" was too dark
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
let currentColorShades = [90, 50, 70, 80, 60];
function getNextColor() {
  if (currentColorIndex == photonColors.length) {
    currentColorIndex = 0;
  }
  if (currentColorShadeIndex == currentColorShades.length) {
    currentColorShadeIndex = 0;
  }
  let color =
    photonColors[currentColorIndex][currentColorShades[currentColorShadeIndex]];
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

  // Home page: mini version of the chart, and links to other stuff
  // Fix colors
  // Meta redirect in awfy/sheet with meta -> potentially redirect to the right component

  let lastDate;
  for (let date in data) {
    lastDate = date;
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

  let firstDay = DAILY_DATA[0];
  let lastDay = DAILY_DATA[DAILY_DATA.length - 1];
  document.querySelector(
    "h1"
  ).textContent += `: ${lastDay.totalTests} Tests Remain`;

  document
    .querySelector("#table")
    .addEventListener("change", buildStackedGraph);
  document.querySelector("#table").addEventListener("click", event => {
    if (event.target.matches("a")) {
      event.preventDefault();
      let link = COMPONENT_LINK_TO_SPREADSHEET_MAP[event.target.textContent];
      if (link) {
        window.open(link);
      }
    }
  });

  // To show most at the start of the project, change this to `firstDay.sortedComponents`
  document.querySelector("#table").innerHTML = lastDay.sortedComponents
    .map((c, i) => {
      return `<tr><td><input type="checkbox" ${
        i < NUM_COMPONENTS_IN_DEFAULT ? "checked" : ""
      } /><a href=".">${c.component}</a>
      </td><td>${COMPONENT_DATA[c.component][lastDate] || 0}</td>`;
    })
    .join("");
  buildStackedGraph();
});

function buildStackedGraph() {
  // console.log(DAILY_DATA, COMPONENT_DATA);
  currentColorIndex = currentColorShadeIndex = 0;

  let days = [];
  for (let day in COMPONENT_DATA["Core::DOM: Core & HTML"]) {
    days.push(day);
  }

  let lastDay = DAILY_DATA[DAILY_DATA.length - 1];
  let datasets = [];

  let otherComponents = [
    ...document.querySelectorAll("input:not(:checked)")
  ].map(el => el.nextSibling.textContent);
  let otherComponentData = [];
  let firstRun = true;
  for (let component of otherComponents) {
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
    el => el.nextSibling.textContent
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
      .querySelector("#component-specific-tests canvas")
      .getContext("2d");

    let chartOptions = {
      type: "line",
      data: {
        labels: days,
        datasets: datasets
      },
      options: {
        maintainAspectRatio: false,
        tooltips: {
          mode: "nearest",
          intersect: false
          // If we want we could use this custom positioner like https://giphy.com/gifs/QzAGXpdTvOJXKbMlUf:
          // position: "fixed",
          // caretSize: 0
        },
        hover: {
          mode: "index",
          animationDuration: 0
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
      chartOptions.options.tooltips = {
        mode: "nearest",
        intersect: false
      };

      chartOptions.options.legend = {
        display: false
      };
    }

    window.myChart = new Chart(ctx, chartOptions);
  }
}
