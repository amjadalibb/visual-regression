const webdriver = require('browserstack-webdriver');
const browserstack = require('browserstack-local');
const resolveAppOptional = require('./resolve').resolveAppOptional;
const { LOG, browserStackURL, uniqueValue, RESULT } = require('./fixtures');
const fse = require('fs-extra');
const url = require('url');
const request = require('request');
const https = require('https');

let bsLocalRunning = false;

const {
  loadOneImage,
  optimizeImage,
  mergeAllImages
} = require('./imageProcessing');

const {
  createFolder,
  removePath,
  pathJoiner,
  getDirName
} = require('./fileProcessing');

/*
 * It confirms if browserstack local has established connection successfully. It returns true if the connection id is found in body
 * @body {object} Contains the information about the response received from Browserstack URL (i.e. 'https://www.browserstack.com/local/v1/list?auth_token={BROWSERSTACK_KEY}&last=5&state=running')
 */
function checkLocalIdentifier(body) {
  if (
    body != undefined &&
    body.instances != undefined &&
    body.instances.length > 0
  ) {
    let result = false;
    body.instances.forEach(instance => {
      LOG.FULL && console.log(`${instance.localIdentifier} == ${uniqueValue}`);
      if (instance.localIdentifier == uniqueValue) {
        result = true;
      }
    });
    return result;
  }
  return false;
}
/*
 * It returns true if page can scroll more within browser otherwise it returns false if page is reached at the end
 * @bsOptions {object} Contains information of scroll result. It looks like this: { scrollHeight: 628, pageYOffset: 3768, clientHeight: 6048 }
 */
function scrollPageMore(bsOptions) {
  if (bsOptions.vars.scrollResult) {
    const scroll = bsOptions.vars.scrollResult;
    LOG.FULL && console.log(scroll);
    if (
      parseInt(scroll.pageYOffset) + parseInt(scroll.scrollHeight) <
        parseInt(scroll.clientHeight) &&
      parseInt(scroll.clientHeight) > parseInt(scroll.scrollHeight) &&
      parseInt(scroll.pageYOffset) != parseInt(scroll.pageYOffsetAfterScroll) &&
      ((bsOptions.vars.ignoreLastScreenshot &&
        scroll.pageYOffset + scroll.scrollHeight ===
          scroll.pageYOffsetAfterScroll) ||
        !bsOptions.vars.ignoreLastScreenshot)
    ) {
      LOG.FULL && console.log('Scroll More: ' + true);
      return true;
    } else {
      LOG.FULL && console.log('Scroll More: ' + false);
      return false;
    }
  } else return false;
}
/*
 * It triggers to stop browserstack local
 * @bsLocal {object} It contains information of the browserstack local.
 */
const stopLocal = (bsLocal, stopBSLocal) =>
  new Promise((resolve, reject) => {
    if (bsLocal && stopBSLocal) {
      LOG.INFO && console.log('BrowserstackLocal Stopping');
      bsLocal.stop(() => {
        LOG.INFO && console.log('BrowserstackLocal Stopped');
        return resolve();
      });
    } else {
      LOG.FULL && console.log(`Stop BrowserstackLocal : ${stopBSLocal}`);
      return resolve();
    }
  });
/*
 * It terminates the active browserstack session
 * @bsOptions {object} It has an object of browserstack driver
 */
const quitDriver = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (bsOptions && bsOptions.vars && bsOptions.vars.driver) {
      await bsOptions.vars.driver.quit();
      LOG.INFO && console.log('Driver Stopped !');
      // setTimeout(() => {
      return resolve();
      // }, 1000);
    } else {
      LOG.INFO &&
        console.log(
          'Stopping browserstack driver - It occurs when new browser is about to start of tests are finished'
        );
      return resolve();
    }
  });
/* 
* It initiates termination of active browserstack session and triggers another browserstack session
* @bsOptions {object} it has information of new browser to trigger
* @bsOptions.vars.browsers will look like this:-
  { label: 'iphone7plus_safari',
    browserName: 'Safari',
    device: 'iPhone 7 Plus',
    'browserstack.local': true,
    realMobile: 'true',
    waitSecondsBeforeScreenShot: '2',
    cropImage: [Object],
    'browserstack.user': 'XXXXXXX',
    'browserstack.key': 'XXXXXXXXXXXXXXXX',
    'browserstack.localIdentifier': '946756800000' },
*/
const refreshDriver = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.INFO && console.log('Refreshing Driver');
      quitDriver(bsOptions).then(() => {
        bsOptions.vars.driver = new webdriver.Builder()
          .usingServer('http://hub.browserstack.com/wd/hub')
          .withCapabilities(bsOptions.vars.browsers)
          .build();
        return resolve(bsOptions);
      });
    } catch (err) {
      LOG.INFO && console.log('Failed Driver' + err);
      return reject(err);
    }
  });
/*
 * Downloads the screenshot from Browserstack Session. It removes the file (if exist) before it downloads new one.
 * @bsOptions {object} Contains the driver of browserstack session
 * @refFile {string} Contains the path of file to save the screenshot
 * @retry {number} Used to make number of download attempts
 */
const downloadScreenshot = (bsOptions, refFile, retry) =>
  new Promise((resolve, reject) => {
    try {
      LOG.DEBUG && console.log('Downloading Screenshot: ' + refFile);
      bsOptions.vars.driver.takeScreenshot().then(
        data => {
          removePath(refFile, () => {
            var stream = fse.createWriteStream(refFile);
            stream.write(new Buffer(data, 'base64'));
            stream.end(() => {
              loadOneImage(refFile).then(
                () => {
                  LOG.DEBUG &&
                    console.log('Screenshot Downloaded Successfully ');
                  return resolve(bsOptions);
                },
                err => {
                  LOG.DEBUG &&
                    console.log('Retrying Download ' + retry + ' out of 5');
                  if (retry <= 5) {
                    retry++;
                    downloadScreenshot(bsOptions, refFile, retry).then(
                      resultBSOptions => {
                        return resolve(resultBSOptions);
                      },
                      err => {
                        return reject(err);
                      }
                    );
                  } else {
                    return reject(err);
                  }
                }
              );
            });
          });
        },
        err => {
          LOG.DEBUG && console.log('Screenshot Downloaded Failed ');
          LOG.DEBUG && console.log(err);
          return reject(err);
        }
      );
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * Scrolls the page and return scroll attributes (i.e. { scrollHeight: 628, pageYOffset: 3768, clientHeight: 6048 })
 * @bsOptions {object} Contains the driver of browserstack session
 * #bsOptions.vars.scrollResult {string} It will look like this: { scrollHeight: 560, pageYOffset: 0, clientHeight: 2892 }
 */
const scrollPage = bsOptions =>
  new Promise(async (resolve, reject) => {
    try {
      if (
        ![
          bsOptions.vars.browsers.requireScroll,
          bsOptions.vars.selTest.requireScroll
        ].includes('false')
      ) {
        LOG.FULL && console.log('Page Scrolling ...');
        let scroll = await bsOptions.vars.driver.executeScript(
          "var scrollHeight=document.querySelector('html').clientHeight," +
            'pageYOffset=window.pageYOffset;' +
            'window.scrollBy(0, scrollHeight);' +
            'return \'{"scrollHeight": \' + scrollHeight + \',"pageYOffset":\' + pageYOffset + ' +
            "',\"clientHeight\":' + document.querySelector('body').clientHeight + '}';"
        );
        bsOptions.vars.scrollResult = scroll = JSON.parse(scroll);
        LOG.FULL &&
          console.log(
            `Downloaded Screenshot and Scrolled, waitAfterScroll (ms): ${
              bsOptions.vars.waitAfterScroll
            }`
          );
        setTimeout(async () => {
          let pageYOffsetAfterScroll = await bsOptions.vars.driver.executeScript(
            "return '{\"pageYOffsetAfterScroll\":' + window.pageYOffset + '}';"
          );
          bsOptions.vars.scrollResult.pageYOffsetAfterScroll = JSON.parse(
            pageYOffsetAfterScroll
          ).pageYOffsetAfterScroll;
          return resolve(bsOptions);
        }, bsOptions.vars.waitAfterScroll);
      } else {
        bsOptions.vars.scrollResult = undefined;
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * It aims to download the entire page
 * @bsOptions {object} contains the value of maxScroll (i.e. maximum allowed number of scrolls)
 * @bsOptions.vars.downloadedImages {array} Stores path of all downloaded screenshots for further processing (crop, merge, optimization)
 * @counter {number} It is used to stop at the maximum number of scroll
 * #newTempPath {string} It stores target path to download the screenshot
 */
const downloadUntilBottom = (bsOptions, counter) =>
  new Promise(async (resolve, reject) => {
    try {
      if (
        counter < (bsOptions.vars.selTest.maxScroll || bsOptions.vars.maxScroll)
      ) {
        LOG.FULL && console.log('Downloading Image - Counter: ' + counter);
        var newTempPath = pathJoiner(
          bsOptions.vars.processDir,
          'temp' + counter + '.png'
        );
        bsOptions.vars.downloadedImages.push(newTempPath);
        bsOptions = await downloadScreenshot(bsOptions, newTempPath, 1);
        bsOptions.vars.optimizeImage && (await optimizeImage(newTempPath));
        bsOptions = await scrollPage(bsOptions);
        counter = counter + 1;
        if (!scrollPageMore(bsOptions)) return resolve(bsOptions);
        else {
          downloadUntilBottom(bsOptions, counter).then(
            resultBSOptions => {
              return resolve(resultBSOptions);
            },
            err => {
              return reject(err);
            }
          );
        }
      } else return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * Check if the title of page is valid. The test should not proceed if page is not found. It usually happens when base url is set to localhost and url is not accessing because code is not published
 */
const checkForCorrectTitle = function(bsOptions) {
  return bsOptions.vars.driver.getTitle().then(
    title => {
      LOG.FULL && console.log('Current Title: ' + title);
      return !(
        ['Page not found', 'Cannot Open Page', 'Failed to open page'].indexOf(
          title
        ) > -1 || title.length === 0
      );
    },
    err => {
      LOG.FULL && console.log('Unable to open page' + err);
      return false;
    }
  );
};
/*
 * It will wait for 20 seconds until valid page title is found.
 * It resolves promise if page title is loaded before timeout otherwise rejects promise
 */
const verifyPageTitle = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.DEBUG && console.log('Checking Title');
      bsOptions.vars.driver
        .wait(() => {
          var result = checkForCorrectTitle(bsOptions);
          return result;
        }, 60000)
        .then(result => {
          if (result) {
            LOG.FULL && console.log('Page is Loaded');
            return resolve(bsOptions);
          } else {
            LOG.FULL && console.log('Unable to open page');
            return reject('Unable to open page');
          }
        });
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * It checks if document state is complete. It executes javascript in browser to find out the state.
 */
const checkDocStateForComplete = function(bsOptions) {
  return bsOptions.vars.driver
    .executeScript('return document.readyState;')
    .then(state => {
      LOG.FULL && console.log('Current State: ' + state);
      return state === 'complete';
    });
};
/*
 * It waits for 20 seconds until page state is complete. Test script will not proceed if page takes more than 20 seconds to load. It is out of scope to make page load timeout configurable (20 seconds are maximum loadtime).
 */
const waitForPageLoadCompletely = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.driver
        .wait(() => {
          return checkDocStateForComplete(bsOptions);
        }, 100000)
        .then(
          result => {
            if (result) return resolve(bsOptions);
            else {
              LOG.FULL && console.log('Page Load Timed Out');
              return reject('Page Load Timed Out');
            }
          },
          err => {
            LOG.FULL && console.log('Unable to open page' + err);
            return reject(err);
          }
        );
    } catch (err) {
      LOG.FULL && console.log(err);
      reject(err);
    }
  });
/* 
* It runs any javascript after page load is complete. The script would do any page related activity (i.e. click button, or hide dynamic div, etc.)
* @bsOptions.vars.selTest.script {string} This script is user defined inside a test (e.g. service-nsw\visual-regression\config\index.js).
* Example of the test with script is below:
{
  label: 'test1',
  script: 'document.getElementById("app").style.display = "none";'
}
*/
const runScript = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (bsOptions.vars.selTest.script)
        bsOptions.vars.driver.executeScript(bsOptions.vars.selTest.script).then(
          result => {
            LOG.FULL &&
              console.log(
                'Script is executed: ' + bsOptions.vars.selTest.script
              );
            LOG.FULL && console.log(result);
            return resolve(bsOptions);
          },
          err => {
            LOG.FULL && console.log('Unable execute script' + err);
            return reject(err);
          }
        );
      else {
        LOG.FULL && console.log('No Script to execute');
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      reject(err);
    }
  });
/*
 * It triggers to open the page and wait until page load is complete / timedout
 * @bsOptions.vars.url {string} It contains URL of page
 * It follows below step:
 * 1. Opens the page
 * 2. Wait until page state is complete
 * 3. Wait until valid page title is found
 *   a. Browserstack sometime first opens blank page for its internal processing and then opens the URL therefore double verification is useful.
 * 4. It runs any script if defined within test
 * 5. Returns resolve of reject based
 */
const openPage = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.FULL && console.log('Open Page: ' + bsOptions.vars.url);
      bsOptions.vars.driver.get(bsOptions.vars.url).then(
        () => {
          waitForPageLoadCompletely(bsOptions)
            .then(verifyPageTitle)
            .then(runScript)
            .then(
              resultBSOptions => resolve(resultBSOptions),
              err => reject(err)
            );
        },
        async err => {
          if (
            [
              'Session not started or terminated',
              'Unable to communicate to node',
              'Could not start Mobile Browser',
              'Appium error: An unknown server-side error occurred while processing the command. Original error: Could not proxy. Proxy error: Could not proxy command to remote server. Original error: Error: ESOCKETTIMEDOUT',
              'A session is either terminated or not started'
            ].includes(err.message) &&
            bsOptions.vars.retryOpenPage > 0
          ) {
            LOG.FULL && console.log(err.message);
            bsOptions.vars.retryOpenPage -= 1;
            let bsOptionsRefreshDriver = await refreshDriver(bsOptions);
            openPage(bsOptionsRefreshDriver).then(
              bsOptionsOpenPage => resolve(bsOptionsOpenPage),
              err => reject(err)
            );
          } else {
            LOG.FULL && console.log(err);
            return reject(err);
          }
        }
      );
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * Initializes Browserstack Local before running the test. It will create tunnel between local machine and browserstack server.
 * It downloads the binary if it doesn't exist.
 * #BROWSERSTACK_KEY {string} This is access key of Browserstack account set within .env file
 * #bsLocal {object} This object is returned and further used to terminate the tunnel
 */
const initializeBSLocal = () =>
  new Promise((resolve, reject) => {
    LOG.INFO && console.log('BrowserstackLocal Starting...');
    var bsLocal = new browserstack.Local();
    const bambooBinaryPath = '/usr/local/bin/BrowserStackLocal';
    var altBinaryPath = resolveAppOptional('bin');
    altBinaryPath =
      altBinaryPath != null
        ? pathJoiner(altBinaryPath, 'BrowserStackLocal')
        : null;
    var config = {
      key: process.env.BROWSERSTACK_KEY,
      v: true,
      forcelocal: true,
      localIdentifier: uniqueValue,
      'enable-logging-for-api': true
    };
    if (fse.existsSync(bambooBinaryPath) == true)
      config.binarypath = bambooBinaryPath;
    else if (fse.existsSync(altBinaryPath) == true)
      config.binarypath = altBinaryPath;
    else {
      config.binarypath = altBinaryPath;
      LOG.INFO && console.log('Unable to find BrowserStackLocal locally');
    }
    createFolder(getDirName(config.binarypath), async () => {
      config.binarypath = await downloadBinaryFile(config.binarypath);
      LOG.DEBUG && console.log(config);
      LOG.DEBUG && console.log('Binary Exists - Now Launching ...');
      bsLocal.start(config, error => {
        if (error) {
          LOG.DEBUG && console.log(error);
          return reject(error);
        }
        LOG.INFO && console.log('BrowserstackLocal Launched');
        return resolve(bsLocal);
      });
    });
  });
/*
 * It will initiate the process of getting the screenshot
 * #bsOptions.vars.screenshotTimeout {number} It is the user defined timeout to wait before taking screenshots. Some articles (e.g. having social embeds) take longer time to load the component.
 */
const getScreenShot = bsOptions =>
  new Promise((resolve, reject) => {
    LOG.FULL &&
      console.log(
        'Waiting before screenshot (ms) :' + bsOptions.vars.screenshotTimeout
      );
    setTimeout(() => {
      processScreenShot(bsOptions).then(
        processScreenShotBSOptions => {
          LOG.FULL && console.log('Returned from processScreenShot');
          return resolve(processScreenShotBSOptions);
        },
        err => {
          return reject(err);
        }
      );
    }, bsOptions.vars.screenshotTimeout);
  });
/*
 * It executes the screeenshot acquiring process
 * @bsOptions.vars.processDir {string} It contains the directory of screenshot to download
 * @bsOptions.vars.processFile {string} It contains the path of target screenshot
 * Steps are below:
 * 1. Make sure that directory of test exists
 * 2. Make sure present screenshot is removed
 * 3. Wait until downloading of screenshot is complete
 * 4. Merge all the downloaded screenshots (i.e. chunks of page)
 * 5. Return resolve if successful otherwise reject the promise
 */
const processScreenShot = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.FULL && console.log('Checking File: ' + bsOptions.vars.processFile);
      createFolder(bsOptions.vars.processDir, () => {
        removePath(bsOptions.vars.processFile, async () => {
          downloadUntilBottom(bsOptions, 0)
            .then(mergeAllImages)
            .then(
              mergedBSOptions => {
                LOG.FULL && console.log('Returned from downloadUntilBottom');
                return resolve(mergedBSOptions);
              },
              err => {
                return reject(err);
              }
            );
        });
      });
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * It will wait until browserstack tunnel is successfully setup (timeout currently set to 60s)
 * It requests Browserstack URL (passing unique local identifier) to confirm that connection is established
 * @runLocal {boolean} It is true if there is a need of tunnel, otherwise false. In some cases, there is no need for tunnel as browserstack server is able to access URL via internet
 * @timeout {number} It represents number of seconds to attempt before timeout (value "60" will retry 60 times after every 1 second)
 * @iteration {number} It is the current iteration, value keeps increasing on every attempt until timeout
 * Script will wait for another 15 seconds to complete the connection
 */
const waitForBSLocal = (runLocal, iteration) =>
  new Promise((resolve, reject) => {
    if (runLocal) {
      if (iteration < 30) {
        if (!bsLocalRunning) {
          console.log('BrowserStack URL: ' + browserStackURL);
          request(browserStackURL, (error, response, body) => {
            LOG.FULL &&
              console.log(
                `BrowserStackLocal trying to establish connection - iteration: ${iteration}`
              );
            if (
              !error &&
              response.statusCode == 200 &&
              checkLocalIdentifier(JSON.parse(body))
            ) {
              LOG.FULL &&
                console.log('BrowserStackLocal connection established ... ');
              bsLocalRunning = true;
              LOG.DEBUG &&
                console.log(
                  'BrowserStackLocal - waiting 15s more for complete connection ...'
                );
              setTimeout(() => {
                return resolve(true);
              }, 15000);
            } else {
              LOG.FULL && error && console.log(error);
              LOG.FULL &&
                console.log('BrowserStackLocal retrying in 1 second ... ');
              setTimeout(() => {
                iteration++;
                waitForBSLocal(runLocal, iteration).then(
                  message => {
                    return resolve(message);
                  },
                  err => {
                    return reject(err);
                  }
                );
              }, 1000);
            }
          });
        } else {
          LOG.FULL && console.log('BrowserStackLocal already running');
          return resolve(true);
        }
      } else {
        return reject('Failed to start BrowserstackLocal - time out');
      }
    } else return resolve(true);
  });
/*
 * It will download the browserstack local binary to path if it doesn't exist.
 * #binaryPath {string} It is path to download the binary
 */
const downloadBinaryFile = binaryPath =>
  new Promise((resolve, reject) => {
    if (fse.existsSync(binaryPath) == false) {
      LOG.DEBUG && console.log('Binary local directory: ' + binaryPath);
      const hostOS = process.platform;
      const is64bits = process.arch == 'x64';
      var httpPath;
      if (hostOS.match(/darwin|mac os/i)) {
        httpPath =
          'https://s3.amazonaws.com/browserStack/browserstack-local/BrowserStackLocal-darwin-x64';
      } else if (
        hostOS.match(/mswin|msys|mingw|cygwin|bccwin|wince|emc|win32/i)
      ) {
        httpPath =
          'https://s3.amazonaws.com/browserStack/browserstack-local/BrowserStackLocal.exe';
      } else {
        if (is64bits)
          httpPath =
            'https://s3.amazonaws.com/browserStack/browserstack-local/BrowserStackLocal-linux-x64';
        else
          httpPath =
            'https://s3.amazonaws.com/browserStack/browserstack-local/BrowserStackLocal-linux-ia32';
      }
      LOG.DEBUG && console.log('Binary HTTPS URL: ' + httpPath);
      var fileStream = fse.createWriteStream(binaryPath);
      var options = url.parse(httpPath);
      var req = https.get(options, response => {
        LOG.FULL && console.log('StatusCode:', response.statusCode);
        response.on('data', d => {
          fileStream.write(d);
        });
      });
      req.on('error', err => {
        return reject(err);
      });
      req.on('close', () => {
        LOG.INFO && console.log('BrowserstackLocal Download Successfully');
        fse.chmod(binaryPath, '0755', () => {
          return resolve(binaryPath);
        });
      });
    } else return resolve(binaryPath);
  });

module.exports = {
  quitDriver,
  refreshDriver,
  downloadUntilBottom,
  getScreenShot,
  openPage,
  initializeBSLocal,
  stopLocal,
  waitForBSLocal
};
