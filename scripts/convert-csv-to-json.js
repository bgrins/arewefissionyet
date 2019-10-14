
var fs = require('fs');
let items =  fs.readdirSync("./cache/imported-from-before-artifacts/");

function shouldIgnoreComponent(component) {
  // We used to ignore components on the frontend, but with the
  // M4 filtering happening in
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

module.exports.process = function() {

for (let item of items) {
  if (item.endsWith("csv")) {
    let date = item.split("T")[0];
    let text = fs.readFileSync(`./cache/imported-from-before-artifacts/${item}`, "utf8");
    let rows = text.split("\n");
    let summary = rows[1].split(",")
    // We want to match something like this for the summary:
    // "summary":{"components":25,"failed tests":34,"manifests":757,"skipped tests":203,"tests":213}
    let obj = {
      'summary': {
        "failed tests": parseInt(summary[3]),
        "skipped tests": parseInt(summary[1]),
      },
      'tests': {}
    };

    for (let j = 2; j < rows.length; j++) {
      let row = rows[j].split(",");
      if (shouldIgnoreComponent(row[0])) {
        continue;
      }
      let component = obj.tests[row[0]] = [];
      // We want to match something like:
      // "tests":{"Core::Audio/Video: Playback":[{"fail-if":"fission","skip-if":"(android_version == '18' || (os == \"win\" && processor == \"aarch64\")) || (android_version >= '23')","test":"dom/media/test/test_autoplay_policy_activation.html"},{"fail-if":"fission","skip-if":"android_version == '18' || (os == \"win\" && processor == \"aarch64\")","test":"dom/media/test/test_access_control.html"}],
      // but we don't have the test-specific data. So just push empty tests
      // so we can get the count right
      let failedTests = parseInt(row[3]);
      let skippedTests = parseInt(row[1]);
      // console.log(row[0], failedTests + skippedTests)
      for (let test = 0; test < failedTests + skippedTests; test++) {
        component.push({})
      }
    }
    fs.writeFileSync(`./cache/imported-from-before-artifacts/${date}.json`, JSON.stringify(obj, null, 2));
  }
}

};
