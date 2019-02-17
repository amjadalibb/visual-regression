const { openPage, getScreenShot } = require('./browserstackProcessing');
const { LOG } = require('./fixtures');
const { writeResult } = require('./result');

const {
  uploadBaselineToS3,
  downloadBaselineFromS3,
  downloadManifestFromS3,
  updateManifest,
  uploadTestDiffToS3OnMismatch
} = require('./s3Processing');

const { compareImages } = require('./imageProcessing');

const { initOptionsVar } = require('./initializeVars');

/* 
* This script triggers the test execution step by step, as below:
* 1. Initializes bsOptions object
*   a. Quit any active browserstack driver, if test has to run on new browser in browserstack. It will also activate browserstack session.
*   b. Setup URLs, Filename, and Paths (etc)
*   c. Setup default settings (Upload / Download Screenshot from S3, Mismatch Tolerance, Timeouts, etc.)
*   d. Setup Browser settings (configuration required for browserstack)
* 2. Download the item from S3 (if required) and save in Baseline directory
* 3. Open the page
*   a. Open the page on browserstack
*   b. Wait for page to load completely
*   c. Verify if valid page title is loaded
*   d. Run any javascript (such as hide any html div ?)
* 3. Get screenshot from the browser in browserstack
*   a. Create local directory to download the screenshots (if doesn't exist)
*   b. Remove any existing file
*   c. Download screenshot from top to bottom (maxScroll applies).
*     i.    Take screenshot and download image
*     ii.   Optimize the image (if required)
*     iii.  Scroll the page and continue downloading image
*     iv.   Stop if end of page or maxScroll value is reached
*     v.    Save path of all downloaded images in bsOptions.vars.downloadedImages
*   d. Crop and merge all download images to one image
* 4. Compare image with baseline
*   a. Skip the process if baseline image is to be update only
*   b. Check the pixel differences and generate mismatch value
*     i.    If mismatch value is greater than tolerance then generate diff
*     ii.   Otherwise, Pass the Test
*   c. Return misMatch value and Result as MATCHED or MISMATCH
* 5. Upload screenshot (baseline or new one) to S3 (if required)
* 6. Return result of test
* 7. Incase there was an error "Unable to communicate to node", then it will try to make another 2 attempts.
*/
const runTest = (
  testElement,
  browser,
  newBrowser,
  cliParams,
  retry,
  bsOptions
) =>
  new Promise((resolve, reject) => {
    initOptionsVar(testElement, browser, newBrowser, cliParams, bsOptions).then(
      initBSOptions => {
        LOG.INFO && console.log(initBSOptions);
        downloadManifestFromS3(initBSOptions)
          .then(downloadBaselineFromS3)
          .then(openPage)
          .then(getScreenShot)
          .then(compareImages)
          .then(uploadBaselineToS3)
          .then(uploadTestDiffToS3OnMismatch)
          .then(updateManifest)
          .then(writeResult)
          .then(uploadBSOptions => {
            return resolve(uploadBSOptions);
          })
          .catch(err => {
            LOG.INFO && console.log(err);
            if (
              err.message &&
              ['Unable to communicate to node'].includes(err.message) &&
              retry > 0
            ) {
              retry--;
              return runTest(
                testElement,
                browser,
                newBrowser,
                cliParams,
                retry,
                bsOptions
              );
            } else {
              initBSOptions.vars.err = err;
              return reject(initBSOptions);
            }
          });
      },
      err => {
        bsOptions.vars.err = err;
        return reject(bsOptions);
      }
    );
  });

module.exports = {
  runTest
};
