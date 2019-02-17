/*
* Visual Regression Framework
*
* This framework tests visual UI differences between previous and current pages. It can also run on CI/CD.

* Visual Regression Tests are currently running every night on Bamboo:

* Any word in comment starting with '@' represent function parameter and starting with '#' represents a variable used in function
*/

const dotenv = require('dotenv').config();
const cliParams = require('./src/extractCliParameters');
const elapsedTime = require('elapsed-time');
let et = new elapsedTime();
const {
  quitDriver,
  initializeBSLocal,
  stopLocal,
  waitForBSLocal
} = require('./src/browserstackProcessing');
const { LOG, RESULT } = require('./src/fixtures');
const { runTest } = require('./src/visualRegression');
const { archive } = require('./src/fileProcessing');
const { processSingleHeadlessTest, stopPuppeteer } = require('./src/headless');
const { uploadManifestS3 } = require('./src/s3Processing');
// Object bsOptions is defined once and then reinitialized again for each test / browser
let bsOptions = undefined;
let bsLocal;
/*
 * Extends assert to add more valuable information like mismatch percentage and tolerance level for the test
 * If  test is failed then it will display a message (Test Failed - Mismatch Percentage (%): 0.10, Mismatch Tolerance (%): 0.05)
 * @received {array} contains value to compare in case of passing test (e.g. RESULT.REFERENCE_UPDATED, RESULT.MATCHED)
 * @argument {number} contains test result (e.g. RESULT.MISMATCH or RESULT.MATCHED)
 * @misMatchPerc {number} value of mismatch percentage
 * @misMatchTol {number} value of mismatch percentage tolerance. Tolerance level can be set different for each test
 */
expect.extend({
  toContainItem(received, argument, misMatchPerc, misMatchTol) {
    const pass = received.includes(argument);
    return {
      pass,
      message: () =>
        pass
          ? `Test Passed`
          : `Test Failed - Mismatch Percentage (%): ` +
            misMatchPerc +
            `, Mismatch Tolerance (%): ` +
            misMatchTol
    };
  }
});
/*
 * Returns elapsed time
 */
const showTime = function() {
  try {
    return et.getValue();
  } catch (err) {
    LOG.FULL && console.log(err);
    return 0;
  }
};
/*
 * Assert result of test and archive screenshots folder if required
 * Archive of screenshots are useful to attach as an artefact with execution on Bamboo
 * @bsOptions {object} It is initiated by initOptionsVar inside initializeVars.js (see the file for more information)
 * #dontFlagTestOnFail: Will flag the test as passed in both failed or passed test
 * #misMatchPercentage: This is a percentage value and it is calculated after current UI screenshot is compared with baseline - it tells how much difference is the between two pages
 * #misMatchtolerance: This value is set in config and it is used to determine if mismatch is meeting tolerance level or not
 */
const wrapUp = bsOptions =>
  new Promise(async resolve => {
    await (!cliParams.dontFlagTestOnFail &&
      bsOptions.vars &&
      bsOptions.vars.result &&
      expect([RESULT.REFERENCE_UPDATED, RESULT.MATCHED]).toContainItem(
        bsOptions.vars.result,
        bsOptions.vars.misMatchPercentage,
        bsOptions.vars.misMatchtolerance
      ));
    LOG.FULL && console.log('WrapUp Done');
    return resolve(bsOptions);
  });
/*
 * Stop Browserstack Local Driver and terminate the browserstack session
 * This function is called once before the end of execution
 * @bsOptions {object} This object is required here because it stores driver object of Browserstack Session
 * @bsLocal {object} This is an object of Browserstack Local
 * #archiveNewImages: Contains value of testFolder which is needed to archive given archiveNewImages is set to true (value is set to true only if --archive is added in commandline)
 * #bsOptions.vars.stopAll {boolean} If true then stop driver otherwise skip
 * Note: Timeout is needed after stopping drivers as it take some time to completely stop Browserstack Session
 */
const stopDrivers = bsOptions =>
  new Promise(async resolve => {
    if (bsOptions.vars.stopAll) {
      cliParams.archiveNewImages && (await archive(bsOptions.vars.testFolder));
      LOG.FULL &&
        console.log(
          `${showTime()} Stopping Drivers: ${bsOptions.vars.stopAll}`
        );
      quitDriver(bsOptions).then(() => {
        stopLocal(bsOptions.bsLocal, cliParams.stopBSLocal).then(() => {
          LOG.FULL &&
            console.log(
              `${showTime()} Stopping Drivers: ${bsOptions.vars.stopAll}`
            );
          return resolve();
        });
      });
    } else return resolve();
  });
/*
 * It will start Browserstack Local and create a tunnel between local server and Browserstack server
 * @runBSLocal {boolean} This value is set to true if command has an argument "--local" or browser in config has it true (i.e. 'browserstack.local': 'true'). In either case, value is true.
 */
const initialize = runBSLocal =>
  new Promise((resolve, reject) => {
    LOG.INFO && console.log(`runBSLocal ${runBSLocal}`);
    if (runBSLocal)
      initializeBSLocal().then(
        local => {
          LOG.INFO && console.log('BrowserstackLocal Started Successfuly !');
          return resolve(local);
        },
        err => {
          throw new Error(err);
        }
      );
    else return resolve();
  });
/*
 * It returns true when set of tests specific to that browser is complete. An active browserstack session is stopped if it returns true
 * @browser {object} It has browser specific details (e.g. device, browsername, label, etc.) with active browserstack session
 * @testItems {object} It has detail of running test suite
 * @item {object} It has detail of running test
 */
function checkIfStop(browser, testItems, item) {
  if (
    (cliParams.headless ||
      cliParams.testBrowsers.indexOf(browser) ==
        cliParams.testBrowsers.length - 1) &&
    cliParams.testPaths.indexOf(testItems) == cliParams.testPaths.length - 1 &&
    testItems.indexOf(item) == testItems.length - 1
  ) {
    LOG.FULL &&
      browser &&
      console.log(`${showTime()} stopAll has been set to true`);
    return true;
  } else return false;
}
/*
 * This method returns true when new browser is started. It is further used for refreshing the browserstack driver for new browser
 */
function checkIfNewBrowser(bsOptions, browser) {
  if (
    bsOptions &&
    bsOptions.vars &&
    bsOptions.vars.selBrowser &&
    browser.label === bsOptions.vars.selBrowser
  ) {
    return false;
  } else return true;
}
/*
 * This will process a single test case
 * @item {object} It has detail of running test
 * @browser {object} It has browser specific details (e.g. device, browsername, label, etc.) with active browserstack session
 * @newBrowser {boolean} It is true if new browser has to start. Useful to know when to restart browserstack driver with new browser
 * @cliParams {object} It has detail of commandline arguments (e.g. runLocal, update screenshot, archive, etc.)
 * @bsOptions {object} It has detail of all configuration settings and test related information required to complete execution. This object will keep updating through out the test.
 * It is initiated by initOptionsVar inside initializeVars.js (see the file for more information)
 */

const processTestItems = (item, browser, cliParams, bsOptions) =>
  new Promise((resolve, reject) => {
    waitForBSLocal(cliParams.runLocal, 1).then(
      async () => {
        let newBrowser = checkIfNewBrowser(bsOptions, browser);
        if (newBrowser) et = await elapsedTime.new().start();
        LOG.FULL && console.log(`Starting to process test`);
        runTest(item, browser, newBrowser, cliParams, 3, bsOptions) // 3 is number of retries
          .then(
            async resultBSOptions => {
              resultBSOptions.vars.index = cliParams.testBrowsers.indexOf(
                browser
              );
              LOG.FULL && console.log(`${showTime()} Returned from runTest`);
              return resolve(resultBSOptions);
            },
            async resultBSOptions => {
              LOG.INFO &&
                console.log(
                  `${showTime()} --- Failed to initialize - Check Config.js or .ENV `
                );
              LOG.INFO &&
                resultBSOptions.vars &&
                console.log(resultBSOptions.vars.err);
              resultBSOptions.vars.result = RESULT.ERROR;
              return reject(resultBSOptions);
            }
          )
          .catch(err => {
            LOG.INFO && console.log(err);
            bsOptions.vars.err = err;
            return reject(bsOptions);
          });
      },
      message => {
        expect(message).toEqual('Up and running');
        return reject(undefined);
      }
    );
  });
/*
 * This function will initiate the initial setup (i.e. launch browserstack local), trigger to run tests for all browsers
 * This is called by .spec.js file residing inside the project (e.g. .../project/visual-regression/visual.spec.js).
 */
const start = () =>
  new Promise((resolve, reject) => {
    if (!cliParams.headless) {
      describe('Visual Regression Testing', async function() {
        beforeAll(async () => {
          bsLocal = await initialize(cliParams.runLocal);
        });
        await runAllBrowsers();
      });
    } else {
      describe('Visual Regression Testing - Headless Mode', async function() {
        await runAllHeadlessTests();
        return resolve();
      });
    }
  });
/*
 * This function traverses through all browsers and triggers all tests that is suppose to run inside the browser
 */
function runAllBrowsers() {
  for (const browser of cliParams.testBrowsers) {
    describe('Environment: ' + browser.label, async () => {
      await runAllTests(browser);
    });
  }
}
/*
 * This function traverses through all tests and trigger a single test
 */
function runAllTests(browser) {
  for (const testItems of cliParams.testPaths) {
    describe('Testing ' + testItems[0], async () => {
      await runSingleTest(browser, testItems);
    });
  }
}
/*
 * This function traverses through all tests and trigger a single headless set of tests
 */
async function runAllHeadlessTests() {
  for (const testItems of cliParams.testPaths) {
    describe('Testing ' + testItems[0], async () => {
      await runSingleHeadlessTest(testItems);
    });
  }
}
/*
 * This function will trigger single test, stop Browserstack driver, archive temp folder, and assert the test
 * #bsOptions {object} It is initially set as undefined but later it is populated and then used by the rest of tests. This object is reinitialized for each tests.
 */
function runSingleTest(browser, testItems) {
  try {
    for (const item of testItems) {
      !((bsOptions && bsOptions.vars && bsOptions.vars.stopAll) || false) &&
        item.label &&
        test(
          item.label + ' - ' + browser.label,
          done => {
            processTestItems(item, browser, cliParams, bsOptions)
              .then(
                resultBSOptions => {
                  bsOptions = resultBSOptions;
                  bsOptions.vars.stopAll = checkIfStop(
                    browser,
                    testItems,
                    item
                  );
                  if (!bsOptions.bsLocal && bsLocal)
                    bsOptions.bsLocal = bsLocal;
                },
                resultBSOptions => {
                  bsOptions = resultBSOptions;
                  bsOptions.vars.stopAll = true;
                }
              )
              .then(async () => {
                uploadManifestS3(bsOptions);
                await stopDrivers(bsOptions);
                await wrapUp(bsOptions);
              })
              .then(async () => {
                await done();
              });
          },
          1000000
        );
    }
  } catch (err) {
    LOG.INFO && console.log('ERROR');
    LOG.INFO && console.log(err);
  }
}
/*
 * This function will trigger single set of headless tests
 * #testItems {object} It is contains information about the tests.
 */
function runSingleHeadlessTest(testItems) {
  try {
    for (const item of testItems) {
      item.label &&
        test(
          item.label,
          done => {
            processSingleHeadlessTest(item, cliParams, bsOptions)
              .then(resultBSOptions => {
                bsOptions = resultBSOptions;
              })
              .then(async () => {
                bsOptions.vars.stopAll = checkIfStop(
                  undefined,
                  testItems,
                  item
                );
                uploadManifestS3(bsOptions);
                stopPuppeteer(bsOptions);
                setTimeout(async () => {
                  await wrapUp(bsOptions);
                }, 500);
              })
              .then(() => {
                setTimeout(async () => {
                  await done();
                }, 2000);
              });
          },
          500000
        );
    }
  } catch (err) {
    LOG.INFO && console.log('ERROR');
    LOG.INFO && console.log(err);
  }
}
module.exports = {
  start
};
