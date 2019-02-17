const { resolveAppRequired } = require('./resolve');
const { LOG } = require('./fixtures');
const { checkPath } = require('./fileProcessing');
let runLocal = false,
  testPaths = [],
  testBrowsers = [],
  updateBaselineScreens = false,
  archiveNewImages = false,
  downloadS3 = false,
  uploadS3 = false,
  uploadS3OnMismatch = false,
  dontFlagTestOnFail = false,
  conf = undefined,
  confPath = null,
  stopBSLocal = true,
  headless = false,
  buildKey = 'default',
  downloadDevelopBuildTag = false,
  uploadDevelopBuildTag = false,
  prevBuildKey = null,
  testArr = [],
  browserArr = [];

/*
 * It loads all test. It will trigger when no test is specified in the command
 */
function loadAllTest() {
  var testPathVar = [];
  for (var p in conf.test) {
    var testObj = [p];
    conf.test[p].forEach(item => {
      item.path = conf.endPoint
        .replace('<type>', p)
        .replace('<label>', item.label);
      item.master = p.toLowerCase();
      testObj.push(item);
    });
    if (testObj.length > 1) testPathVar.push(testObj);
  }
  return testPathVar;
}

/*
 * It loads specific tests only.
 */
function loadSpecificTests(testNames) {
  testArr = testNames.split(',').map(s => s.trim().toLowerCase());
  for (var p in conf.test) {
    var testObj = [p];
    let addAll = false;
    if (testArr.indexOf(p.toLowerCase()) > -1) addAll = true;
    conf.test[p].forEach(item => {
      for (var testItem of testArr) {
        const testItemArr = testItem.split('/');
        if (
          (testItemArr.length == 1 &&
            item.label.toLowerCase() == testItemArr[0]) ||
          (testItemArr.length == 2 &&
            item.label.toLowerCase() == testItemArr[1] &&
            p.toLowerCase() == testItemArr[0]) ||
          addAll
        ) {
          // if (testArr.indexOf(item.label) > -1 || addAll) {
          item.path = conf.endPoint
            .replace('<type>', p)
            .replace('<label>', item.label);
          item.master = p.toLowerCase();
          testObj.push(item);
          break;
        }
      }
    });
    if (testObj.length > 1) testPaths.push(testObj);
  }
}
/*
 * It will load the visual regression config if provided in CLI arguments. Config has test, browser and other default information
 */
process.argv.forEach(arg => {
  if (arg === '--vrconfig') {
    confPath = resolveAppRequired(process.argv[1 + process.argv.indexOf(arg)]);
    conf = require(confPath);
  }
});
/*
 * If config path is saved in .env file then it will load that config, otherwise it will look for default config path
 */
if (process.env.VISUAL_REGRESSION_CONFIG) {
  confPath = resolveAppRequired(process.env.VISUAL_REGRESSION_CONFIG);
  conf = require(confPath);
} else if (
  !conf &&
  checkPath(resolveAppRequired('visual-regression/config/index.js'))
) {
  confPath = resolveAppRequired('visual-regression/config/index.js');
  conf = require(confPath);
}
if (process.env.BUILD_KEY) {
  buildKey = process.env.BUILD_KEY;
}
/*
 * It will throw error if no config is found
 */
if (!conf) {
  throw new Error('Failed to load config');
}

/*
 * Loads all commandline arguments
 * "--name" should have the name(s) of test separated by "comma"
 * "--env" should have the name of environment(s) separated by "comma".
 * "--update" will only update the screenshot in reference directory (service-nsw / visual-regression / screenshots / reference / <Test Name>).
 * "--local" will launch BrowserStackLocal (located in service-nsw/bin) and force browserstack to use the tunnel for all traffic. Although, Binary will download automatically but you can manually get it from (https://www.browserstack.com/local-testing). Moreover, If browser parameters in config includes `browserstack.local=true` then there is no need to put this argument in commandline.
 * "--vrconfig" will override the default config file (service-nsw /visual-regression/config/index.js)
 * "--archive" will create the .zip file of temp folder at the end of the execution
 * "--downloads3" will download the baseline screenshots from S3 (if it exists)
 * "--uploads3" will upload image to S3 (if image doesn't exist on S3 OR used in conjunction with --update)
 * "--uploads3onmismatch" will upload new image to S3 (if test is failed due to mismatch)
 * "--dontflag" will flag all the tests as passed but still save the diff files
 */
process.argv.forEach(arg => {
  switch (arg.toLowerCase()) {
    case '-l':
    case '--local': // run on
      runLocal = true;
      break;
    case '-n':
    case '--name':
      loadSpecificTests(process.argv[1 + process.argv.indexOf(arg)]);
      break;
    case '-e':
    case '--env':
      browserArr = process.argv[1 + process.argv.indexOf(arg)]
        .split(',')
        .map(s => s.trim());
      conf.bsOptions.environments.forEach(browser => {
        if (browserArr.indexOf(browser.label) > -1) {
          if (browser['browserstack.local']) runLocal = true;
          testBrowsers.push(browser);
        }
      });
      break;
    case '-u':
    case '--update':
      updateBaselineScreens = true;
      break;
    case '-a':
    case '--archive':
    case '--archivenewimages':
      archiveNewImages = true;
      break;
    case '-d3':
    case '--downloads3':
      downloadS3 = true;
      break;
    case '-gb':
    case 'getbaseline':
    case '--getbaseline':
      downloadS3 = true;
      downloadDevelopBuildTag = true;
      break;
    case '-pa':
    case 'putall':
    case '--putall':
      uploadS3 = true;
      uploadS3OnMismatch = true;
      uploadDevelopBuildTag = false;
      break;
    case '-pb':
    case 'putbaseline':
    case '--putbaseline':
      uploadS3 = true;
      uploadS3OnMismatch = true;
      uploadDevelopBuildTag = true;
      break;
    case '-u3':
    case '--uploads3':
      uploadS3 = true;
      break;
    case '-u3m':
    case '--uploads3onmismatch':
      uploadS3OnMismatch = true;
      break;
    case '-df':
    case '--dontflag':
      dontFlagTestOnFail = true;
      break;
    case '-ds':
    case '--dontstopbslocal':
      stopBSLocal = false;
      break;
    case '-h':
    case '--headless':
      headless = true;
      break;
    case '-bk':
    case '--buildkey':
      buildKey = process.argv[1 + process.argv.indexOf(arg)];
      break;
    case '-pbk':
    case '--prevbuildkey':
      prevBuildKey = process.argv[1 + process.argv.indexOf(arg)];
      break;
    default:
      if (testPaths.length === 0) loadSpecificTests(arg.toLowerCase());
      break;
  }
});
if (browserArr.length > 0 && testBrowsers.length == 0 && !headless)
  throw new Error('Unable to find the test or environment in config');
/*
 * loadAllTest() will trigger when no test is specified in the command
 * Similarly, all browsers will load if no specific browser is defined in command
 */
testPaths = testPaths.length === 0 ? loadAllTest() : testPaths;

if (!headless) {
  testBrowsers =
    testBrowsers.length == 0 ? conf.bsOptions.environments : testBrowsers;
  LOG.FULL && console.log(testBrowsers);
}

module.exports = {
  runLocal,
  testPaths,
  testBrowsers,
  updateBaselineScreens,
  archiveNewImages,
  stopBSLocal,
  headless,
  downloadS3,
  uploadS3,
  uploadS3OnMismatch,
  dontFlagTestOnFail,
  conf,
  confPath,
  buildKey,
  prevBuildKey,
  downloadDevelopBuildTag,
  uploadDevelopBuildTag
};
