const { RESULT, LOG } = require('./fixtures');
const {
  writeJSON,
  removePath,
  pathJoiner,
  getDirName
} = require('./fileProcessing');

/* 
* It initiates JSON result variable
* @bsOptions {object} It has all test related values and objects
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    bsOptions.vars.resultJSON: { name: 'default',
      s3Bucket: '../default',
      baseURL: 'https://www.service.nsw.gov.au',
      results: [] },
  },
    ......
}
*/
const initResult = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      bsOptions.vars.resultPath = pathJoiner(
        getDirName(getDirName(bsOptions.vars.manifestPath)),
        'result.json'
      );
      removePath(bsOptions.vars.resultPath, () => {
        bsOptions.vars.resultJSON = {
          name: bsOptions.vars.buildKey,
          s3BaseURL: 'https://s3-ap-southeast-2.amazonaws.com/',
          s3BuildBucket: bsOptions.vars.s3BuildBucket,
          baseURL: bsOptions.vars.baseURL,
          results: []
        };
        writeJSON(bsOptions.vars.resultJSON, bsOptions.vars.resultPath);
        return resolve(bsOptions);
      });
    } catch (err) {
      LOG.INFO && console.log('Failed initResult' + err);
      return reject(err);
    }
  });

/* 
* It modifies JSON result variable
* @bsOptions {object} It has all test related values and objects
* Part of bsOptions that is changed :-
{ vars: 
  { ......
    bsOptions.vars.resultJSON: { name: 'default',
      s3Bucket: '.../default',
      baseURL: 'https://www.service.nsw.gov.au',
      results: [
        {
          test: 'test1',
          uri: '',
          result: 3,
          images: { baseline: '../1f8lmq8mejipjb1v3.png' } 
        }
      ]},
  },
    ......
}
*/
const generateResult = bsOptions =>
  new Promise(async (resolve, reject) => {
    try {
      let testResult = {
        test:
          bsOptions.vars.selTest.master + '/' + bsOptions.vars.selTest.label,
        uri: bsOptions.vars.selTest.path,
        result: bsOptions.vars.result,
        mismatchpercentage: bsOptions.vars.misMatchPercentage,
        mismatchtolerance: `${bsOptions.vars.misMatchtolerance}`,
        images: {
          test: pathJoiner(
            bsOptions.vars.s3BuildBucket,
            bsOptions.vars.s3TestKey
          ),
          diff: pathJoiner(
            bsOptions.vars.s3BuildBucket,
            bsOptions.vars.s3DiffKey
          ),
          baseline: pathJoiner(
            bsOptions.vars.s3BaselineDownloadBucket,
            bsOptions.vars.s3BaseKey
          )
        }
      };
      LOG.INFO && console.log(testResult);
      bsOptions.vars.resultJSON.results.push(testResult);
      return resolve(bsOptions);
    } catch (err) {
      LOG.INFO && console.log('Failed generateResult' + err);
      return reject(err);
    }
  });
/*
 * It writes the modified JSON result in result.json file
 * @bsOptions {object} It has test result data
 */
const writeResult = bsOptions =>
  new Promise(async (resolve, reject) => {
    if (
      bsOptions.vars.result == RESULT.MISMATCH &&
      bsOptions.vars.uploadS3OnMismatch
    ) {
      generateResult(bsOptions).then(async bsOptionsResult => {
        await writeJSON(
          bsOptionsResult.vars.resultJSON,
          bsOptions.vars.resultPath
        );
        return resolve(bsOptionsResult);
      });
    } else return resolve(bsOptions);
  });

module.exports = {
  initResult,
  writeResult
};
