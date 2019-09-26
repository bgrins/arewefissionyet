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
  // let data = await fetchSampleDataCSV();

  let dailyData = [];
  let componentData = {};
  console.log(data);


  for (let date in data) {
    let currentDay = data[date];
    for (let component in currentDay.tests) {
      console.log(component, currentDay.tests[component].length);
      componentData[component] = componentData[component] || {};
      componentData[component][date] = currentDay.tests[component].length;
    }
    dailyData.push(currentDay);

    // let sortedComponents = currentDay.sortedComponents = [];
    // for (let component in currentDay.tests) {
    //   // let componentTests = currentDay.tests[component];
    //   sortedComponents.push({ component, tests: currentDay.tests[component].length });
    //   // console.log(`${component}: ${componentTests.length}`)
    // }
    // sortedComponents = sortedComponents.sort((a, b) => {
    //   return a.tests < b.tests;
    // });
  }

  let lastDay = dailyData[dailyData.length - 1];
  let numTestsThatNeedAddressing = lastDay.summary["skipped tests"] +
                                   lastDay.summary["failed tests"];
  document.querySelector("h1").textContent = numTestsThatNeedAddressing + " " + document.querySelector("h1").textContent ;



  await renderCharts(convertJSONForChart(data));
  buildStackedGraph(dailyData, componentData)
  // document.querySelector("#table").innerHTML = lastDay.sortedComponents.map((c, i) => {
  //   return `<tr><td><input type="checkbox" ${i<=5 ? "checked" : ""} />${c.component}</td><td>${c.tests.length}</td>`;
  // }).join("");
});

window.chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};

function buildStackedGraph(dailyData, componentData) {
  // XXX: This is only using the last day, we need a more full picture here
  // with data from each day
  console.log(dailyData, componentData);

  let days = [];
  for (let day in componentData["Core::DOM: Core & HTML"]) {
    days.push(day);
  }

  let lastDay = dailyData[dailyData.length - 1]
  let datasets = [];

  // let topComponents = dailyData[0].sortedComponents.slice(0, 2).map(c=>c.component);
  let topComponents = ["Core::DOM: Core & HTML"];
  for (let component of topComponents) {
    let data = [];
    for (let days in componentData[component]) {
      console.log(componentData[component][days]);
      data.push(componentData[component][days])
    }
    datasets.push({
      label: component,
      // borderColor: window.chartColors.red,
      // backgroundColor: window.chartColors.red,
      data
    });
  }
  // for (let i = 0; i < 8; i++) {
  //   // for (let j = 0; j < dailyData.length; j++) {
  //   //   dailyData[j].tests[]
  //   // }
  //   let componentData = lastDay.sortedComponents[i];
  //   datasets.push({
  //     label: componentData.component,
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
