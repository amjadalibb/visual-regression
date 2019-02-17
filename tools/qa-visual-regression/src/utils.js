const http = require('http');
const chalk = require('chalk');

// return error message if the API key is null
const checkApiKey = apiKey =>
  new Promise((resolve, reject) => {
    if (!apiKey) {
      reject('Cannot find API key. Check if you have a valid .env file.');
    } else {
      resolve();
    }
  });

// return error message if a component name is not specified
const checkArg = args =>
  new Promise((resolve, reject) => {
    const component = args[2] ? args[2] : false;
    if (!component) {
      reject('You have not specified a component for testing');
    } else {
      resolve(component);
    }
  });

// find the Storybook URL by story name
const getTestPath = (component, config) =>
  new Promise((resolve, reject) => {
    // drill down into test object to look for a match
    let foundType = false;
    Object.keys(config.test).map(type => {
      if (!foundType) {
        const labels = config.test[type].map(path => path.label);
        const match = labels.find(path => path === component);
        if (match) {
          foundType = type;
        }
      }
    });

    if (!foundType) {
      reject(
        'Cannot find a matching component in the config.\nFor component names of more than one word, use double quotes; e.g. "Article Header"'
      );
    } else {
      resolve(
        config.baseURL +
          config.endPoint
            .replace('<type>', foundType)
            .replace('<label>', component)
      );
    }
  });

// check the Storybook is running and the URL is valid
const checkURL = (url, baseURL) => {
  const errorMessage = `URL failed to load. Check if ${baseURL} is running.`;
  return new Promise((resolve, reject) => {
    http
      .get(url, response => {
        if (response && response.statusCode !== 404) {
          resolve(url);
        } else {
          reject(errorMessage);
        }
      })
      .on('error', error => reject(errorMessage));
  });
};

// start BrowserStackLocal
const startBSLocal = (bsLocal, bsConfig) =>
  new Promise((resolve, reject) => {
    if (bsLocal.isRunning()) {
      resolve();
    } else {
      bsLocal.start(bsConfig, () => {
        console.log(chalk.cyan('⏳  Starting BrowserStackLocal...'));
        resolve();
      });
    }
  });

// poll BrowserStackLocal until it is running
const waitForTunnel = (bsLocal, timeout = 10000, interval = 2000) => {
  const endTime = Number(new Date()) + timeout;

  const checkIfRunning = (resolve, reject) => {
    const result = bsLocal.isRunning();
    if (result) {
      console.log(chalk.cyan('👍🏼  BrowserStackLocal is now running...'));
      resolve();
    } else if (Number(new Date()) < endTime) {
      console.log(chalk.cyan('⏳  waiting for tunnel...'));
      setTimeout(checkIfRunning, interval, resolve, reject);
    } else {
      reject('timed out while waiting for BrowserStackLocal tunnel to open');
    }
  };

  return new Promise(checkIfRunning);
};

module.exports = {
  checkApiKey,
  checkArg,
  getTestPath,
  checkURL,
  startBSLocal,
  waitForTunnel
};
