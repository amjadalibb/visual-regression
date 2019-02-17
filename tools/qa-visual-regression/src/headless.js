const { LOG } = require('./fixtures');
const { initHeadlessOptionsVar } = require('./initializeVars');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra');
const { compareImages } = require('./imageProcessing');
const { writeResult } = require('./result');
const {
  uploadBaselineToS3,
  downloadBaselineFromS3,
  downloadManifestFromS3,
  updateManifest,
  uploadTestDiffToS3OnMismatch
} = require('./s3Processing');

const processSingleHeadlessTest = (testElement, cliParams, bsOptions) =>
  new Promise((resolve, reject) => {
    initHeadlessOptionsVar(testElement, cliParams, bsOptions).then(
      initBSOptions => {
        downloadManifestFromS3(initBSOptions)
          .then(downloadBaselineFromS3)
          .then(launchPuppeteer)
          .then(setViewport)
          .then(emulateDevice)
          .then(openPage)
          .then(waitSecondsBeforeScreenShot)
          .then(takeScreenshot)
          .then(compareImages)
          .then(uploadBaselineToS3)
          .then(uploadTestDiffToS3OnMismatch)
          .then(updateManifest)
          .then(writeResult)
          .then(writeBSOptions => {
            LOG.INFO && console.log(writeBSOptions);
            return resolve(writeBSOptions);
          })
          .catch(err => {
            LOG.INFO && console.log(err);
            initBSOptions.vars.err = err;
            return reject(initBSOptions);
          });
      }
    );
  });

const launchPuppeteer = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (!bsOptions.vars.puppeteer) {
      LOG.INFO && console.log('Launching puppeteer');
      bsOptions.vars.puppeteer = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });
      bsOptions.vars.page = await bsOptions.vars.puppeteer.newPage();
      return resolve(bsOptions);
    } else {
      return resolve(bsOptions);
    }
  });

const setViewport = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (
      (bsOptions.vars.selTest.headless &&
        bsOptions.vars.selTest.headless.viewportWidth) ||
      (bsOptions.vars.headless && bsOptions.vars.headless.viewportWidth)
    ) {
      const viewportWidth = parseInt(
        bsOptions.vars.selTest.headless &&
        bsOptions.vars.selTest.headless.viewportWidth
          ? bsOptions.vars.selTest.headless.viewportWidth
          : bsOptions.vars.headless && bsOptions.vars.headless.viewportWidth
            ? bsOptions.vars.headless.viewportWidth
            : 0
      );
      LOG.INFO && console.log(`Setting View Port - Width ${viewportWidth}`);
      bsOptions.vars.page.setViewport({
        width: viewportWidth,
        height: 0
      });
      let result = await bsOptions.vars.page.evaluate(() => {
        return window.innerWidth;
      });
      LOG.INFO && console.log(`View port width is set to : ${result}`);
      return resolve(bsOptions);
    } else {
      return resolve(bsOptions);
    }
  });

const emulateDevice = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (
      ((bsOptions.vars.selTest.headless &&
        bsOptions.vars.selTest.headless.emulateDevice) ||
        (bsOptions.vars.headless && bsOptions.vars.headless.emulateDevice)) &&
      !(
        bsOptions.vars.selTest.headless &&
        bsOptions.vars.selTest.headless.viewportWidth &&
        !bsOptions.vars.selTest.headless.emulateDevice
      )
    ) {
      const deviceName =
        bsOptions.vars.selTest.headless &&
        bsOptions.vars.selTest.headless.emulateDevice
          ? bsOptions.vars.selTest.headless.emulateDevice
          : bsOptions.vars.headless && bsOptions.vars.headless.emulateDevice
            ? bsOptions.vars.headless.emulateDevice
            : undefined;
      const emulatingDevice = devices[deviceName];
      LOG.INFO && console.log('Emulating Device');
      LOG.INFO && console.log(emulatingDevice);
      bsOptions.vars.page.emulate(emulatingDevice);
      await bsOptions.vars.page.waitFor(500);
      let result = await bsOptions.vars.page.evaluate(() => {
        return window.innerWidth;
      });
      return resolve(bsOptions);
    } else {
      return resolve(bsOptions);
    }
  });

const stopPuppeteer = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (bsOptions.vars.puppeteer && bsOptions.vars.stopAll) {
      LOG.INFO && console.log('Stopping puppeteer');
      await bsOptions.vars.puppeteer.close();
      return resolve(bsOptions);
    } else {
      return resolve(bsOptions);
    }
  });

const openPage = bsOptions =>
  new Promise(async (resolve, reject) => {
    LOG.INFO && console.log(bsOptions.vars.url);
    await bsOptions.vars.page.goto(bsOptions.vars.url);
    return resolve(bsOptions);
  });

const waitSecondsBeforeScreenShot = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (
      bsOptions.vars.headless &&
      bsOptions.vars.headless.waitSecondsBeforeScreenShot
    ) {
      LOG.INFO &&
        console.log(
          `Waiting Seconds : ${
            bsOptions.vars.headless.waitSecondsBeforeScreenShot
          }`
        );
      setTimeout(() => {
        return resolve(bsOptions);
      }, bsOptions.vars.headless.waitSecondsBeforeScreenShot * 1000);
    } else {
      return resolve(bsOptions);
    }
  });

const takeScreenshot = bsOptions =>
  new Promise(async (resolve, reject) => {
    LOG.INFO && console.log('Taking screenshot');
    try {
      await fse.ensureDirSync(bsOptions.vars.processDir);
      bsOptions.vars.page
        .screenshot({
          type: 'png',
          path: bsOptions.vars.processFile,
          fullPage: true
        })
        .then(() => {
          LOG.INFO && console.log(`Saved in ${bsOptions.vars.processDir}`);
          return resolve(bsOptions);
        });
    } catch (err) {
      LOG.INFO && console.log(err);
      return reject(bsOptions);
    }
  });

module.exports = {
  processSingleHeadlessTest,
  stopPuppeteer
};
