/*
 * This module is responsible for initializing bsOptions object that is used across the application
 * The object contains all processed, unprocessed data about test, browser, configuration, etc.
 * The object is reintialized after browser refresh (i.e. the task on specific browser is finished and new browser is started)
 */

const url = require('url');
const { RESULT, LOG, uniqueValue } = require('./fixtures');
const { quitDriver, refreshDriver } = require('./browserstackProcessing');
const { initResult } = require('./result');

const {
  removePath,
  checkPath,
  pathJoiner,
  getDirName,
  pathJoinerOptional
} = require('./fileProcessing');
/*
 * It loads default configuration to process screenshots
 * #bsOptions.vars.optimizeImage {boolean} If value is true then it will optimize the image
 * #bsOptions.vars.updateBaselineScreens {boolean} If value is true or baseline screenshot does not exist then it will set the script to update baseline screenshot only. It will skip comparison and test will pass.
 * #bsOptions.vars.refFile {string} It is file path of baseline screenshot
 * #bsOptions.vars.baselineFolder {string} It is path of baseline screenshot directory
 * #bsOptions.vars.screenFile {string} It is path of temporary screenshot that will be used to compare with baseline
 * #bsOptions.vars.testFolder {string} It is directory path of temporary screenshot
 * #bsOptions.vars.result {number} The value is set as REFERENCE_UPDATED if only baseline screenshot is to update, otherwise it is set as SCREEN_UPDATED. This value is further used in compare images to determine if image is to compare or skip.
 * It returns bsOptions object containing mentioned populated values
 */
const initProcessScreenShotVars = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.optimizeImage = !bsOptions.vars.selTest.optimizeImage
        ? !bsOptions.vars.optimizeImage
          ? false
          : bsOptions.vars.optimizeImage
        : bsOptions.vars.selTest.optimizeImage;
      if (
        bsOptions.vars.updateBaselineScreens ||
        !checkPath(bsOptions.vars.refFile)
      ) {
        bsOptions.vars.processFile = bsOptions.vars.refFile;
        bsOptions.vars.processDir = bsOptions.vars.baselineFolder;
        bsOptions.vars.result = RESULT.REFERENCE_UPDATED;
        return resolve(bsOptions);
      } else {
        bsOptions.vars.processFile = bsOptions.vars.screenFile;
        bsOptions.vars.processDir = bsOptions.vars.testFolder;
        bsOptions.vars.result = RESULT.SCREEN_UPDATED;
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.INFO && console.log('Failed initProcessScreenShotVars' + err);
      return reject(err);
    }
  });
/* 
* It loads default configuration to initiate and perform operation on browsers
* @bsOptions {object} It may already have some browser related configuration (i.e. waitAfterScroll, or maxScroll)
* @browser {object} It contain detail of the browser (e.g. browserName, device, label, etc.)
* @runLocal {boolean} Value is true if browserstack local need to start
* #bsOptions.vars.browsers {object} It is the browser object that will be passed by browserstack driver to initiate the session
* #browser['browserstack.user'] {string} It is the browserstack username and requires browserstack username to be stored in environment variable BROWSERSTACK_USERNAME
* #browser['browserstack.key'] {string} It is the browserstack key and requires browserstack key to be stored in environment variable BROWSERSTACK_KEY
* #browser['browserstack.local'] {boolean} If value is true then browserstack will reroute the traffic via tunnel.
* #bsOptions.vars.waitAfterScroll {number} Script will wait for number of milliseconds after scrolling the page and taking screenshot
* #bsOptions.vars.maxScroll {number} Script will do maximum number of allowed scrolls and then stop after that. Some pages are too big for image processing.
* It returns bsOptions object with populated values
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    browsers: 
    { label: 'macos_high_sierra_safari',
      browserName: 'Safari',
      os: 'OS X',
      os_version: 'macOS High Sierra',
      requireScroll: 'false',
      resolution: '1024x768',
      'browserstack.local': true,
      'browserstack.user': 'amjadali4',
      'browserstack.key': '',
      'browserstack.localIdentifier': '946756800000' },
    selBrowser: 'macos_high_sierra_safari' },
    ......
}
*/
const initBSOptionsBrowser = (bsOptions, browser, runLocal) =>
  new Promise((resolve, reject) => {
    try {
      if (process.env.BROWSERSTACK_KEY && process.env.BROWSERSTACK_USERNAME) {
        browser['browserstack.user'] = process.env.BROWSERSTACK_USERNAME;
        browser['browserstack.key'] = process.env.BROWSERSTACK_KEY;
        browser['browserstack.local'] = runLocal;
        if (runLocal) browser['browserstack.localIdentifier'] = uniqueValue;
        bsOptions.vars.browsers = JSON.parse(JSON.stringify(browser));
        bsOptions.vars.selBrowser = browser.label;
        bsOptions.vars.waitAfterScroll =
          (!bsOptions.vars.waitAfterScroll
            ? 0
            : parseInt(bsOptions.vars.waitAfterScroll)) +
          (!browser.waitAfterScroll ? 0 : parseInt(browser.waitAfterScroll));
        bsOptions.vars.maxScroll = bsOptions.vars.maxScroll || 20;
        return resolve(bsOptions);
      } else {
        LOG.INFO && console.log('Browserstack Credentials Not Valid');
        return reject('Browserstack Credentials Not Valid');
      }
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsBrowser' + err);
      return reject(err);
    }
  });
/* 
* It will populate the base url for all the tests
* @bsOptions {object} It has all test related values and objects
* @baseURL {string} It is the path of base URL and requires a URL to be stored in environment variable STORYBOOK_URL
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    baseURL: 'http://XXX.net.au' },
    ......
}
*/
const initBSOptionsBaseURL = (bsOptions, baseURL) =>
  new Promise((resolve, reject) => {
    try {
      if (process.env.STORYBOOK_URL) {
        bsOptions.vars.baseURL = process.env.STORYBOOK_URL;
        return resolve(bsOptions);
      } else if (baseURL) {
        bsOptions.vars.baseURL = baseURL;
        return resolve(bsOptions);
      } else {
        LOG.INFO && console.log('Check Base URL');
        return reject('Check Base URL');
      }
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsBaseURL' + err);
      return reject(err);
    }
  });

/* 
* It will setup variables for S3 only
* @bsOptions {object} It has all test related values and objects
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    s3ManifestKey: 'manifest.json',
    bsOptions.vars.manifestPath: '/Users/.../visual-regression/results/screenshots/manifest.json',
    ......
}
*/
const initBSOptionsS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.s3Manifest = undefined;
      bsOptions.vars.s3ManifestKey = 'manifest.json';
      bsOptions.vars.manifestPath = pathJoiner(
        getDirName(getDirName(getDirName(bsOptions.vars.baselineFolder))),
        bsOptions.vars.s3ManifestKey
      );
      removePath(bsOptions.vars.manifestPath, () => resolve(bsOptions));
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsS3' + err);
      return reject(err);
    }
  });
/* 
* It sets value extracted from CLI arguments
* @bsOptions {object} It has all test related values and objects
* @cliParams {object} It has all configuration values provided with CLI command
* #bsOptions.vars.downloadS3 {boolean} If value is true then script will download baseline screenshot from S3 before running the test
* The argument "--downloads3" in command line will set the value as true
* #bsOptions.vars.uploadS3 {boolean} If value is true then script will upload baseline screenshot to S3 after baseline screenshot is updated
* The argument "--uploadS3" in command line will set the value as true
* #bsOptions.vars.uploadS3OnMismatch {boolean} If value is true then script will upload baseline screenshot to S3 after mismatch occurred. Script will upload new screenshot to S3 so it should pass next time (It will create Diff). This is useful to have it as part of CI/CD for automatic uploads.
* The argument "--updateBaselineScreens" in command line will set the value as true
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    downloadS3: false,
    uploadS3: false,
    uploadS3OnMismatch: false,
    updateBaselineScreens: false,
    bsOptions.vars.buildKey = '',
    bsOptions.vars.prevBuildKey = '';
  },
    ......
}
*/
const initBSOptionsCliVar = (bsOptions, cliParams) =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.downloadS3 = cliParams.downloadS3;
      bsOptions.vars.uploadS3 = cliParams.uploadS3;
      bsOptions.vars.uploadS3OnMismatch = cliParams.uploadS3OnMismatch;
      bsOptions.vars.updateBaselineScreens = cliParams.updateBaselineScreens;
      bsOptions.vars.buildKey = cliParams.buildKey
        ? cliParams.buildKey
        : 'default';
      bsOptions.vars.s3BuildBucket = `${bsOptions.vars.s3Bucket}/${
        bsOptions.vars.buildKey
      }`;
      bsOptions.vars.prevBuildKey = cliParams.prevBuildKey
        ? cliParams.prevBuildKey
        : bsOptions.vars.buildKey;
      bsOptions.vars.downloadDevelopBuildTag =
        cliParams.downloadDevelopBuildTag;
      bsOptions.vars.uploadDevelopBuildTag = cliParams.uploadDevelopBuildTag;
      bsOptions.vars.downloadBuildTag = cliParams.downloadDevelopBuildTag
        ? bsOptions.vars.developBuildTag
        : bsOptions.vars.featureBuildTag;
      bsOptions.vars.uploadBuildTag = cliParams.uploadDevelopBuildTag
        ? bsOptions.vars.developBuildTag
        : bsOptions.vars.featureBuildTag;
      return resolve(bsOptions);
    } catch (err) {
      LOG.INFO && console.log('Failed initVars' + err);
      return reject(err);
    }
  });
/* 
* It updates path of all directories (i.e. Referance, Temp, Diff)
* @bsOptions {object} Contains default path for temp, reference and diff directory
* @freshPath {boolean} If value is true then it is the first time setting paths, otherwise it should renew old variables
* @testElement {object} It is the object containing test related information (e.g. label, desc, etc.)
* #bsOptions.vars.testFolder {string} It is the path of temp directory for a test
* #bsOptions.vars.baselineFolder {string} It is the path of baseline directory for a test
* #bsOptions.vars.diffFolder {string} It is the path of diff directory for a test
* Part of bsOptions that is changed :-
{ vars: 
  {
    testFolder: '/Users/...../visual-regression/results/screenshots/temp/XXX',
    baselineFolder: '/Users/...../visual-regression/results/screenshots/reference/XXX',
    diffFolder: '/Users/..../visual-regression/results/screenshots/diff/XXX',
    ......
  },
    ......
}
*/
const initBSOptionsPathVars = (bsOptions, freshPath, testElement) =>
  new Promise((resolve, reject) => {
    try {
      if (freshPath) {
        bsOptions.vars.testFolder = pathJoinerOptional(
          bsOptions.vars.testFolder,
          testElement.master + '/' + testElement.label
        );
        bsOptions.vars.baselineFolder = pathJoinerOptional(
          bsOptions.vars.baselineFolder,
          testElement.master + '/' + testElement.label
        );
        bsOptions.vars.diffFolder = pathJoinerOptional(
          bsOptions.vars.diffFolder,
          testElement.master + '/' + testElement.label
        );
        return resolve(bsOptions);
      } else {
        bsOptions.vars.testFolder = pathJoiner(
          getDirName(getDirName(bsOptions.vars.testFolder)),
          testElement.master + '/' + testElement.label
        );
        bsOptions.vars.baselineFolder = pathJoiner(
          getDirName(getDirName(bsOptions.vars.baselineFolder)),
          testElement.master + '/' + testElement.label
        );
        bsOptions.vars.diffFolder = pathJoiner(
          getDirName(getDirName(bsOptions.vars.diffFolder)),
          testElement.master + '/' + testElement.label
        );
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsPathVars' + err);
      return reject(err);
    }
  });
/* 
* It is to reset all values according to the test (e.g. misMatchTolerance, filename, etc.)
* @bsOptions {object} It contains default values and adds more test related data
* @conf {object} It contains configuration of visual regression config
* @browser {object} It contain detail of the browser (e.g. browserName, device, label, etc.)
* @testElement {object} It is the object containing test related information (e.g. label, desc, etc.)
* #bsOptions.vars.misMatchtolerance {number} It is the mismatch tolerance percentage value for the test. Some tests may require high tolerance value
* #bsOptions.vars.prefixImage {string} It is the prefix to add with filename so it doesn't replace any existing file on S3
* #bsOptions.vars.fileName {string} It is the name of screenshot file (prefix + browser.label + '.png')
* #bsOptions.vars.s3Path {string} It is S3 path of the file
* #bsOptions.vars.requireScroll {boolean} If value is true then script will not scroll the page. Selenium returns screenshot of the entire page
* #bsOptions.vars.downloadedImages {array} It is an array of all downloaded screenshots for further image processing (crop, merge, and compare, etc.)
* #bsOptions.vars.retryOpenPage {number} It is the number of attempts script should make in case of any error at openning the page (e.g. browserstack session is timed out)
* #bsOptions.vars.screenshotTimeout {number} It is number of screens the script should wait before start downloading the page. It is the time out between page load and taking screenshots
* Script will also remove any diff if already exist in directory for current test
* Part of bsOptions that is changed :-
{ vars: 
  {    
    ......
    misMatchtolerance: 0.01,
    ......
    fileName: 'macos_high_sierra_safari.png',
    refFile: '/Users/...../visual-regression/results/screenshots/reference/XXX/macos_high_sierra_safari.png',
    screenFile: '/Users/...../visual-regression/results/screenshots/temp/XXX/macos_high_sierra_safari.png',
    diffFile: '/Users/...../visual-regression/results/screenshots/diff/XXX/macos_high_sierra_safari.jpg',
    s3Path: 'XXX/macos_high_sierra_safari.png',
    selTest: 
    { label: 'XXX',
      path: 'iframe.html?selectedKind=Layout&selectedStory=XXX' },
    requireScroll: 'false',
    url: 'https://www.service.nsw.gov.au/category/business-trade',
    downloadedImages: [],
    retryOpenPage: 3,
    scrollResult: undefined,
    screenshotTimeout: 2000,
    processFile: '/Users/...../visual-regression/results/screenshots/temp/XXX/macos_high_sierra_safari.png',
    processDir: '/Users/...../visual-regression/results/screenshots/temp/XXX',
    result: 1
  },
    ......
}
*/
const initBSOptionsDefaults = (bsOptions, conf, browser, testElement) =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.misMatchtolerance = testElement.misMatchtolerance
        ? parseFloat(testElement.misMatchtolerance)
        : parseFloat(conf.bsOptions.vars.misMatchtolerance);
      bsOptions.vars.misMatchtolerance += browser['addMisMatchtolerance']
        ? parseFloat(browser['addMisMatchtolerance'])
        : 0.0;
      bsOptions.vars.fileName =
        (bsOptions.vars.prefixImage || '') + browser.label + '.png';
      bsOptions.vars.refFile = pathJoiner(
        bsOptions.vars.baselineFolder,
        bsOptions.vars.fileName
      );
      bsOptions.vars.screenFile = pathJoiner(
        bsOptions.vars.testFolder,
        bsOptions.vars.fileName
      );
      bsOptions.vars.diffFile = pathJoiner(
        bsOptions.vars.diffFolder,
        bsOptions.vars.fileName.replace('.png', '.jpg')
      );
      bsOptions.vars.s3Path = pathJoiner(
        testElement.master + '/' + testElement.label,
        bsOptions.vars.fileName
      );
      bsOptions.vars.selTest = testElement;
      if (bsOptions.vars.browsers) {
        bsOptions.vars.requireScroll =
          bsOptions.vars.browsers.requireScroll ||
          bsOptions.vars.selTest.requireScroll ||
          true;
      }
      bsOptions.vars.url = url.resolve(
        bsOptions.vars.baseURL,
        testElement.path
      );
      bsOptions.vars.downloadedImages = [];
      bsOptions.vars.fileToUploadS3 = undefined;
      bsOptions.vars.s3BaselineKey = undefined;
      bsOptions.vars.retryOpenPage = 3;
      bsOptions.vars.scrollResult = undefined;
      bsOptions.vars.ignoreLastScreenshot =
        browser['ignoreLastScreenshot'] || false;
      bsOptions.vars.screenshotTimeout =
        (bsOptions.vars.waitSecondsBeforeScreenShot * 1000 || 0) +
        (testElement.waitSecondsBeforeScreenShot * 1000 || 0) +
        (parseInt(browser['waitSecondsBeforeScreenShot']) * 1000 || 0);
      removePath(bsOptions.vars.diffFile, async () => {
        const bsOptionsProcessScreenShot = await initProcessScreenShotVars(
          bsOptions
        );
        resolve(bsOptionsProcessScreenShot);
      });
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsDefaults' + err);
      return reject(err);
    }
  });
/* 
* It initiatization all the required values for the test to process
* Detail of default bsOptions loaded from config (Before):-
{ vars: 
  { testFolder: '../visual-regression/results/screenshots/temp',
    baselineFolder: '../visual-regression/results/screenshots/reference',
    diffFolder: '../visual-regression/results/screenshots/diff',
    misMatchtolerance: 0.01,
    optimizeImage: false,
    maxScroll: 20,
    waitSecondsBeforeScreenShot: '2',
    waitAfterScroll: '500',
    s3Bucket: '' },
environments: 
  [ { label: 'win7_chrome',
      browserName: 'Chrome',
      os: 'Windows',
      os_version: '7',
      resolution: '1024x768',
      'browserstack.local': 'true' 
    },
    .........
  }]
}
* Detail of bsOptions after setup:-
 { vars: 
    { testFolder: '/Users/...../visual-regression/results/screenshots/temp/XXX',
      baselineFolder: '/Users/...../visual-regression/results/screenshots/reference/XXX',
      diffFolder: '/Users/...../visual-regression/results/screenshots/diff/XXX',
      misMatchtolerance: 0.01,
      optimizeImage: false,
      maxScroll: 20,
      waitSecondsBeforeScreenShot: '2',
      waitAfterScroll: 500,
      s3Bucket: '',
      browsers: 
      { label: 'macos_high_sierra_safari',
        browserName: 'Safari',
        os: 'OS X',
        os_version: 'macOS High Sierra',
        requireScroll: 'false',
        resolution: '1024x768',
        'browserstack.local': true,
        'browserstack.user': 'amjadali4',
        'browserstack.key': '',
        'browserstack.localIdentifier': '946756800000' },
      selBrowser: 'macos_high_sierra_safari',
      baseURL: 'https://www.service.nsw.gov.au',
      downloadS3: false,
      uploadS3: false,
      uploadS3OnMismatch: false,
      updateBaselineScreens: false,
      fileName: 'macos_high_sierra_safari.png',
      refFile: '/Users/...../visual-regression/results/screenshots/reference/XXX/macos_high_sierra_safari.png',
      screenFile: '/Users/...../visual-regression/results/screenshots/temp/XXX/macos_high_sierra_safari.png',
      diffFile: '/Users/...../visual-regression/results/screenshots/diff/XXX/macos_high_sierra_safari.jpg',
      s3Path: 'XXX/macos_high_sierra_safari.png',
      selTest: 
      { label: 'XXX',
        path: 'category/business-trade' },
      requireScroll: 'false',
      url: 'https://www.service.nsw.gov.au/category/business-trade',
      downloadedImages: [],
      retryOpenPage: 3,
      scrollResult: undefined,
      screenshotTimeout: 2000,
      processFile: '/Users/...../visual-regression/results/screenshots/temp/XXX/macos_high_sierra_safari.png',
      processDir: '/Users/...../visual-regression/results/screenshots/temp/XXX',
      result: 1 },
  environments: 
    [ { label: 'win7_chrome',
        browserName: 'Chrome',
        os: 'Windows',
        os_version: '7',
        resolution: '1024x768',
        'browserstack.local': 'true' 
      },
      ...... 
    ]
}
*/
const initBSOptionsSetup = (bsOptions, browser, testElement, cliParams) =>
  new Promise(async (resolve, reject) => {
    try {
      var conf = require(cliParams.confPath);
      if (!bsOptions) {
        bsOptions = JSON.parse(JSON.stringify(conf.bsOptions)); //Cloning bsObject
        const bsOptionsBrowser = await initBSOptionsBrowser(
          bsOptions,
          browser,
          cliParams.runLocal
        );
        const bsOptionsURL = await initBSOptionsBaseURL(
          bsOptionsBrowser,
          conf.baseURL
        );
        const bsOptionsCliVars = await initBSOptionsCliVar(
          bsOptionsURL,
          cliParams
        );
        const bsOptionsPathVar = await initBSOptionsPathVars(
          bsOptionsCliVars,
          true,
          testElement
        );
        const bsOptionsDefaults = await initBSOptionsDefaults(
          bsOptionsPathVar,
          conf,
          browser,
          testElement
        );
        const bsOptionsS3 = await initBSOptionsS3(bsOptionsDefaults);
        const bsOptionsResult = await initResult(bsOptionsS3);
        const bsOptionsRefDriver = await refreshDriver(bsOptionsResult);
        return resolve(bsOptionsRefDriver);
      } else {
        const bsOptionsPathVar = await initBSOptionsPathVars(
          bsOptions,
          false,
          testElement
        );
        const bsOptionsDefaults = await initBSOptionsDefaults(
          bsOptionsPathVar,
          conf,
          browser,
          testElement
        );
        return resolve(bsOptionsDefaults);
      }
    } catch (err) {
      LOG.INFO && console.log('Failed initBSOptionsSetup' + err);
      return reject(err);
    }
  });
/*
 * It initiates setup of bsOptions and also quits browserstack driver if new browser is to use
 */
const initOptionsVar = (
  testElement,
  browser,
  newBrowser,
  cliParams,
  bsOptions
) =>
  new Promise(async (resolve, reject) => {
    LOG.DEBUG &&
      console.log(
        'Running Test: ' +
          testElement.label +
          ' Browser: ' +
          browser.label +
          ' Update: ' +
          cliParams.updateBaselineScreens
      );
    LOG.DEBUG &&
      testElement.desc &&
      console.log(`NewBrowser ${newBrowser} - Desc: ${testElement.desc}`);
    if (newBrowser) {
      await quitDriver(bsOptions);
      bsOptions = undefined;
    }
    initBSOptionsSetup(bsOptions, browser, testElement, cliParams).then(
      bsOptionsInit => {
        return resolve(bsOptionsInit);
      },
      err => {
        return reject(err);
      }
    );
  });
/*
 * It initiates setup of bsOptions and also quits browserstack driver if new browser is to use
 */
const initHeadlessOptionsVar = (testElement, cliParams, bsOptions) =>
  new Promise(async (resolve, reject) => {
    var conf = require(cliParams.confPath);
    if (!bsOptions) {
      const bsOptionsOrig = {
        vars: JSON.parse(JSON.stringify(conf.bsOptions)).vars
      };
      const bsOptionsURL = await initBSOptionsBaseURL(
        bsOptionsOrig,
        conf.baseURL
      );
      const bsOptionsCliVars = await initBSOptionsCliVar(
        bsOptionsURL,
        cliParams
      );
      const bsOptionsPathVar = await initBSOptionsPathVars(
        bsOptionsCliVars,
        true,
        testElement
      );
      const bsOptionsDefaults = await initBSOptionsDefaults(
        bsOptionsPathVar,
        conf,
        { label: 'headless' },
        testElement
      );
      const bsOptionsS3 = await initBSOptionsS3(bsOptionsDefaults);
      const bsOptionsResult = await initResult(bsOptionsS3);
      return resolve(bsOptionsResult);
    } else {
      const bsOptionsPathVar = await initBSOptionsPathVars(
        bsOptions,
        false,
        testElement
      );
      const bsOptionsDefaults = await initBSOptionsDefaults(
        bsOptionsPathVar,
        conf,
        { label: 'headless' },
        testElement
      );
      return resolve(bsOptionsDefaults);
    }
  });

module.exports = {
  initOptionsVar,
  initHeadlessOptionsVar
};
