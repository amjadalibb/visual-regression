const uniqid = require('uniqid');
process.env.VISUAL_REGRESSION_LOG = process.env.VISUAL_REGRESSION_LOG || 3;

const LOG = {
  INFO: process.env.VISUAL_REGRESSION_LOG > 0,
  DEBUG: process.env.VISUAL_REGRESSION_LOG > 1,
  FULL: process.env.VISUAL_REGRESSION_LOG > 2
};
// This is used for the purpose of saving test result
const RESULT = {
  SCREEN_UPDATED: 1, // Baseline screenshot is updated
  REFERENCE_UPDATED: 2, // Baseline screenshot is saved in reference folder
  MATCHED: 3, // Screenshot is matched with the baseline
  MISMATCH: 4, // Screenshot does not match with baseline
  ERROR: 5 // Error occurred duing the processing
};
// This URL is used to check if Browserstack Local has successfully established connection with server
const browserStackURL =
  'https://www.browserstack.com/local/v1/list?auth_token=' +
  process.env.BROWSERSTACK_KEY +
  '&last=5&state=running';

// This is used for the purpose of having unique local identifier when establishing tunnel with browserstack server so that the request is not mixed up with other's request
const uniqueValue = uniqid();

module.exports = { RESULT, LOG, browserStackURL, uniqueValue };
