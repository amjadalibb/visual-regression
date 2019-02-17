/*
 * This module can perform an activity related to AWS S3 (e.g. download or upload)
 * Before using these, you need to make sure that your account has write access on S3 Bucket
 */
const AWS = require('aws-sdk');
const fse = require('fs-extra');
const { RESULT, LOG } = require('./fixtures');
const uniqid = require('uniqid');
const {
  createFolder,
  removePath,
  checkPath,
  writeJSON
} = require('./fileProcessing');
/*
 * It maps file path with manifest and returns the key to upload on s3
 */
const checkFileInManifestUpload = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (bsOptions.vars.s3Manifest) {
        let s3BaselineKey = undefined;
        for (buildIndex in bsOptions.vars.s3Manifest.manifest) {
          const build = bsOptions.vars.s3Manifest.manifest[buildIndex];
          if (build.buildKey === bsOptions.vars.buildKey) {
            bsOptions.vars.s3BuildBucket = `${bsOptions.vars.s3Bucket}/${
              build.buildKey
            }`;
            for (screenshotIndex in build.screenshots) {
              const screenshot = build.screenshots[screenshotIndex];
              if (screenshot.s3Path === bsOptions.vars.s3Path) {
                s3BaselineKey = screenshot.s3BaselineKey;
              }
            }
          }
        }
        bsOptions.vars.s3BaselineKey = s3BaselineKey
          ? s3BaselineKey
          : bsOptions.vars.s3Path.replace(
              bsOptions.vars.fileName,
              `${uniqid()}.png`
            );
        return resolve(bsOptions);
      } else {
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/* 
* It decides which file to upload on S3 (baseline or new file)
* Below is the area of bsOptions required for this method:-
{ vars: 
  { .....
    uploadS3: true,
    uploadS3OnMismatch: true,
    screenFile: '/Users/...../.../macos_high_sierra_safari.png',
    s3Path: 'Test1/macos_high_sierra_safari.png',
    fileToUploadS3: '/Users/...../.../macos_high_sierra_safari.png',
    result: 1
    .....
  }
}
*/
const checkPathToUploadS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      console.log(
        `checkPathToUploadS3 Result: ${
          bsOptions.vars.result
        } s3BaselineDownloadBucket: ${
          bsOptions.vars.s3BaselineDownloadBucket
        } s3BuildBucket: ${bsOptions.vars.s3BuildBucket}`
      );
      if (
        (RESULT.REFERENCE_UPDATED == bsOptions.vars.result ||
          (RESULT.MATCHED == bsOptions.vars.result &&
            bsOptions.vars.s3BaselineDownloadBucket !=
              bsOptions.vars.s3BuildBucket)) &&
        bsOptions.vars.uploadS3
      )
        bsOptions.vars.fileToUploadS3 = bsOptions.vars.refFile;
      else if (
        bsOptions.vars.result == RESULT.MISMATCH &&
        bsOptions.vars.uploadS3OnMismatch
      )
        bsOptions.vars.fileToUploadS3 = bsOptions.vars.screenFile;
      if (
        bsOptions.vars.fileToUploadS3 &&
        !checkPath(bsOptions.vars.fileToUploadS3)
      ) {
        LOG.FULL &&
          console.log(
            'Checking file path to upload on S3 does not exist - ' +
              bsOptions.vars.fileToUploadS3
          );
        bsOptions.vars.fileToUploadS3 = undefined;
        return resolve(bsOptions);
      } else return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* It uploads the file on S3
* You must have AWS access on above terminal (See comments on top)
* @bsOptions {object} It has Bucket name, File Path to Upload, and Location to upload on S3
* Below is the area of bsOptions required for this method:-
{ vars: 
  { .....
    fileToUploadS3: '/Users/...../.../macos_high_sierra_safari.png',
    s3BuildBucket: 'service-nsw-screenshots',
    s3Path: 'Test1/macos_high_sierra_safari.png',
    .....
  }
}
*/
const processUploadS3 = (bucketName, s3Path, filePath) =>
  new Promise((resolve, reject) => {
    try {
      LOG.DEBUG &&
        console.log(
          `Uploading to S3, bucket: ${bucketName} Key: ${s3Path} filePath: ${filePath}`
        );
      fse.readFile(filePath, (err, data) => {
        if (err) {
          LOG.FULL && console.log('Error processUploadS3: ' + err);
          return reject(err);
        } else {
          var s3 = new AWS.S3({ correctClockSkew: true });
          var params = {
            Bucket: bucketName,
            Key: s3Path,
            Body: data
          };
          s3.putObject(params, (err, s3Data) => {
            if (err) {
              LOG.FULL && console.log('Error processUploadS3: ' + err);
              return reject(err);
            } else LOG.DEBUG && console.log(s3Data);
            return resolve();
          });
        }
      });
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * It confirms the file path and also triggers uploading it to S3
 * This method is exported to external libraries to trigger upload to s3
 * It returns bsOptions in resolve or reject
 */
const uploadBaselineToS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      // Do not update baseline screenshot if baseline screenshot is downloaded from other build key
      if (
        bsOptions.vars.downloadDevelopBuildTag ==
        bsOptions.vars.uploadDevelopBuildTag
      ) {
        checkFileInManifestUpload(bsOptions)
          .then(checkPathToUploadS3)
          .then(pathBSOptions => {
            if (pathBSOptions.vars.fileToUploadS3) {
              processUploadS3(
                pathBSOptions.vars.s3BuildBucket,
                pathBSOptions.vars.s3BaselineKey,
                pathBSOptions.vars.fileToUploadS3
              ).then(
                () => {
                  return resolve(pathBSOptions);
                },
                err => {
                  return reject(err);
                }
              );
            } else return resolve(bsOptions);
          });
      } else return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * It confirms the temp and diff file path and also triggers uploading it to S3
 * This method is exported to external libraries to trigger upload diff and test to s3
 * It returns bsOptions in resolve or reject
 */
const uploadTestDiffToS3OnMismatch = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (
        bsOptions.vars.result == RESULT.MISMATCH &&
        bsOptions.vars.uploadS3OnMismatch
      ) {
        bsOptions.vars.s3DiffKey = bsOptions.vars.s3Path.replace(
          bsOptions.vars.fileName,
          `${uniqid()}.png`
        );
        processUploadS3(
          bsOptions.vars.s3BuildBucket,
          bsOptions.vars.s3DiffKey,
          bsOptions.vars.diffFile
        ).then(
          () => {
            if (
              bsOptions.vars.downloadDevelopBuildTag ==
              bsOptions.vars.uploadDevelopBuildTag
            ) {
              // Baseline screenshot is updated with test screenshot so s3BaselineKey is actually a test screenshot
              bsOptions.vars.s3BaseKey = bsOptions.vars.s3Path.replace(
                bsOptions.vars.fileName,
                `${uniqid()}.png`
              );
              bsOptions.vars.s3TestKey = bsOptions.vars.s3BaselineKey;
              processUploadS3(
                bsOptions.vars.s3BuildBucket,
                bsOptions.vars.s3BaseKey,
                bsOptions.vars.refFile
              ).then(() => {
                return resolve(bsOptions);
              });
            } else {
              // s3BaselineKey is an actual baseline screenshot
              bsOptions.vars.s3BaseKey = bsOptions.vars.s3BaselineKey;
              bsOptions.vars.s3TestKey = bsOptions.vars.s3Path.replace(
                bsOptions.vars.fileName,
                `${uniqid()}.png`
              );
              processUploadS3(
                bsOptions.vars.s3BuildBucket,
                bsOptions.vars.s3TestKey,
                bsOptions.vars.screenFile
              ).then(() => {
                return resolve(bsOptions);
              });
            }
          },
          err => {
            return reject(err);
          }
        );
      } else return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * It maps file path with manifest and returns the key to upload on s3
 *                   downloadBuildTag is Develop build tag
 *                        /                     \
 *                     true                     false
 *                      /                          \
 *       download latest develop             download baseline
 *         baseline screenshot                 with build key
 */
const checkFileInManifestDownload = bsOptions =>
  new Promise(async (resolve, reject) => {
    try {
      if (bsOptions.vars.s3Manifest) {
        let s3BaselineKey = undefined,
          createdDate = undefined,
          s3BuildBucket = undefined;
        for (buildIndex in bsOptions.vars.s3Manifest.manifest) {
          const build = bsOptions.vars.s3Manifest.manifest[buildIndex];
          if (
            (bsOptions.vars.developBuildTag ===
              bsOptions.vars.downloadBuildTag &&
              build.buildTag === bsOptions.vars.downloadBuildTag) ||
            (bsOptions.vars.featureBuildTag ===
              bsOptions.vars.downloadBuildTag &&
              build.buildKey === bsOptions.vars.buildKey)
          ) {
            LOG.FULL && console.log(build);
            for (screenshotIndex in build.screenshots) {
              const screenshot = build.screenshots[screenshotIndex];
              if (screenshot.s3Path === bsOptions.vars.s3Path) {
                createdDate = build.createdDate;
                s3BaselineKey = screenshot.s3BaselineKey;
                s3BuildBucket = build.s3BuildBucket;
              }
            }
          }
        }
        bsOptions.vars.s3BaselineKey = s3BaselineKey
          ? s3BaselineKey
          : bsOptions.vars.s3Path.replace(
              bsOptions.vars.fileName,
              `${uniqid()}.png`
            );
        bsOptions.vars.s3BaselineDownloadBucket = s3BuildBucket
          ? s3BuildBucket
          : bsOptions.vars.s3BuildBucket;
        return resolve(bsOptions);
      } else {
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * This method downloads any item from S3
 * @bucketName {string} It has Bucket name
 * @Key {string} It is the name of Key on S3
 * @fileDir {string} It is the directory of file path locally
 * @filePath {string} It is the file path locally
 * It removes any existing file before downloading
 * It also create directories for the file to download (if directories don't exist)
 * This method is not exported to external libraries
 */
const downloadItemFromS3 = (bucketName, s3Path, fileDir, filePath) =>
  new Promise((resolve, reject) => {
    try {
      var s3 = new AWS.S3({ correctClockSkew: true });
      var params = {
        Bucket: bucketName,
        Key: s3Path
      };
      LOG.DEBUG &&
        console.log(
          `Downloading item from S3, bucket: ${bucketName} Key: ${s3Path} filePath: ${filePath}`
        );
      removePath(filePath, () => {
        createFolder(fileDir, () => {
          var output = fse.createWriteStream(filePath);
          output.on('close', () => {
            LOG.DEBUG && console.log('Downloaded: ' + filePath);
            return resolve();
          });
          s3.getObject(params)
            .createReadStream()
            .on('error', err => {
              removePath(filePath, () => {
                LOG.DEBUG &&
                  console.log('Unable to download due to error: ' + err.name);
                return reject(err);
              });
            })
            .pipe(output);
        });
      });
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* This method is triggered at the start of test execution. It downloads item from S3 which is further used as a baseline screenshot to evaluate the test.
* @bsOptions {object} It has Bucket name, File Path to download, and Location to download from S3
* Below is the area of bsOptions required for this method:-
{ vars: 
  { .....
    baselineFolder: '/Users/...../service-nsw/visual-regression/results/screenshots/reference/Test1',
    downloadS3: false,
    refFile: '/Users/...../service-nsw/visual-regression/results/screenshots/reference/Test1/macos_high_sierra_safari.png',
    s3BaselineDownloadBucket: 'service-nsw-screenshots/develop-day2',
    s3Path: 'Test1/macos_high_sierra_safari.png',
    .....
  }
}
* It removes any existing baseline screnshot from path before downloading
* It also create directories for the file to download (if directories don't exist)
* This method is exported to external libraries
*/
const downloadBaselineFromS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (bsOptions.vars.downloadS3) {
        LOG.DEBUG && console.log('Downloading Baseline From S3');
        checkFileInManifestDownload(bsOptions).then(s3BSOptions => {
          downloadItemFromS3(
            s3BSOptions.vars.s3BaselineDownloadBucket,
            s3BSOptions.vars.s3BaselineKey,
            s3BSOptions.vars.baselineFolder,
            s3BSOptions.vars.refFile
          ).then(
            () => {
              s3BSOptions.vars.result = RESULT.SCREEN_UPDATED;
              s3BSOptions.vars.processFile = s3BSOptions.vars.screenFile;
              s3BSOptions.vars.processDir = s3BSOptions.vars.testFolder;
              return resolve(s3BSOptions);
            },
            err => {
              if (err.name == 'NoSuchKey') {
                LOG.DEBUG &&
                  console.log(
                    'Download item from S3 due to error: ' + err.name
                  );
                s3BSOptions.vars.result = RESULT.REFERENCE_UPDATED;
                s3BSOptions.vars.processFile = s3BSOptions.vars.refFile;
                s3BSOptions.vars.processDir = s3BSOptions.vars.baselineFolder;
                return resolve(s3BSOptions);
              } else {
                LOG.DEBUG && console.log('Error downloadItemFromS3: ' + err);
                return reject('Error downloadItemFromS3: ' + err);
              }
            }
          );
        });
      } else resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * It updates manifest object with the changes
 * In case of develop branch, keep only 1 version
 */
const updateManifestWithChanges = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (bsOptions.vars.s3Manifest) {
        LOG.FULL && console.log(bsOptions.vars.s3Manifest);
        for (buildIndex in bsOptions.vars.s3Manifest.manifest) {
          const build = bsOptions.vars.s3Manifest.manifest[buildIndex];
          LOG.FULL &&
            console.log(
              `Build Index ${buildIndex} - Manifest Length ${bsOptions.vars
                .s3Manifest.manifest.length - 1}`
            );
          if (
            build.buildKey === bsOptions.vars.buildKey ||
            (build.buildTag === bsOptions.vars.uploadBuildTag &&
              build.buildTag === bsOptions.vars.developBuildTag)
          ) {
            // Place where the build already exist
            LOG.FULL && console.log('Triggered manifest when build exist');
            let newItem = {
              s3Path: bsOptions.vars.s3Path,
              s3BaselineKey: bsOptions.vars.s3BaselineKey
            };
            let updateManifest = true;
            for (screenshotIndex in build.screenshots) {
              const buildScreenshots = build.screenshots[screenshotIndex];
              if (
                buildScreenshots.s3Path === bsOptions.vars.s3Path &&
                buildScreenshots.s3BaselineKey === bsOptions.vars.s3BaselineKey
              ) {
                updateManifest = false;
              }
            }
            LOG.FULL && console.log(`Update Manifest ${updateManifest}`);
            if (updateManifest) {
              bsOptions.vars.s3Manifest.manifest[buildIndex].screenshots.push(
                newItem
              );
            }
            return resolve(bsOptions);
          } else if (
            buildIndex ==
            bsOptions.vars.s3Manifest.manifest.length - 1
          ) {
            // Place where build does not exist
            LOG.FULL &&
              console.log('Triggered manifest when build doesnt exist');
            let date = new Date();
            let newBuild = {
              buildKey: bsOptions.vars.buildKey,
              buildTag: bsOptions.vars.uploadBuildTag,
              s3BuildBucket: bsOptions.vars.s3BuildBucket,
              createdDate: date.toISOString(),
              screenshots: [
                {
                  s3Path: bsOptions.vars.s3Path,
                  s3BaselineKey: bsOptions.vars.s3BaselineKey
                }
              ]
            };
            bsOptions.vars.s3Manifest.manifest.push(newBuild);
            LOG.FULL && console.log(bsOptions.vars.s3Manifest);
            return resolve(bsOptions);
          }
        }
      } else {
        return reject('Manifest does not exist');
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/* 
* It generates manifest to store the keys and values of baseline
* @bsOptions {object} It has Bucket name, Manifest path on s3 to download
* Below is the area of bsOptions required for this method:-
{ vars: 
  { .....
    buildKey: '',
    manifestPath: '/Users/.../visual-regression/results/screenshots/manifest.json',
    .....
  }
}
* This method is used internally only
*/
const writeManifest = bsOptions =>
  new Promise(async (resolve, reject) => {
    try {
      if (!bsOptions.vars.s3Manifest) {
        let date = new Date();
        bsOptions.vars.s3Manifest = {
          manifest: [
            {
              buildKey: bsOptions.vars.buildKey,
              buildTag: bsOptions.vars.uploadBuildTag,
              s3BuildBucket: bsOptions.vars.s3BuildBucket,
              createdDate: date.toISOString(),
              screenshots: []
            }
          ]
        };
      }
      await writeJSON(bsOptions.vars.s3Manifest, bsOptions.vars.manifestPath);
      return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/*
 * This method is exported to external libraries to trigger changes in manifest
 * It returns bsOptions in resolve or reject
 */
const updateManifest = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (checkPath(bsOptions.vars.manifestPath)) {
        updateManifestWithChanges(bsOptions)
          .then(writeManifest)
          .then(updateBSOptions => {
            return resolve(updateBSOptions);
          });
      } else {
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/* 
* It downloads manifest from S3 which is further used to download baseline screenshot from.
* @bsOptions {object} It has Bucket name, Manifest path on s3 to download
* Below is the area of bsOptions required for this method:-
{ vars: 
  { .....
    baselineFolder: '/Users/...../service-nsw/visual-regression/results/screenshots/reference/Test1',
    downloadS3: false,
    refFile: '/Users/...../service-nsw/visual-regression/results/screenshots/reference/Test1/macos_high_sierra_safari.png',
    s3Bucket: 'service-nsw-screenshots',
    s3Path: 'Test1/macos_high_sierra_safari.png',
    .....
  }
}
* It removes any existing baseline screnshot from path before downloading
* It also create directories for the file to download (if directories don't exist)
* This method is exported to external libraries
*/
const downloadManifestFromS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (
        !checkPath(bsOptions.vars.manifestPath) &&
        (bsOptions.vars.uploadS3 ||
          bsOptions.vars.uploadS3OnMismatch ||
          bsOptions.vars.downloadS3)
      ) {
        // LOG.FULL && console.log(bsOptions);
        downloadItemFromS3(
          bsOptions.vars.s3Bucket,
          bsOptions.vars.s3ManifestKey,
          bsOptions.vars.baselineFolder,
          bsOptions.vars.manifestPath
        ).then(
          async () => {
            if (checkPath(bsOptions.vars.manifestPath)) {
              var contents = await fse.readFileSync(
                bsOptions.vars.manifestPath
              );
              bsOptions.vars.s3Manifest = JSON.parse(contents);
              return resolve(bsOptions);
            }
          },
          async err => {
            if (err.name == 'NoSuchKey') {
              LOG.DEBUG && console.log('Manfiest does not exist on S3 ');
              let generateBSOptions = await writeManifest(bsOptions);
              return resolve(generateBSOptions);
            } else {
              return reject('Error downloadItemFromS3: ' + err);
            }
          }
        );
      } else resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/*
 * This method uploads manifest to s3
 * It returns bsOptions in resolve or reject
 */
const uploadManifestS3 = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      if (
        bsOptions.vars.stopAll &&
        checkPath(bsOptions.vars.manifestPath) &&
        (bsOptions.vars.uploadS3 || bsOptions.vars.uploadS3OnMismatch)
      ) {
        processUploadS3(
          bsOptions.vars.s3Bucket,
          bsOptions.vars.s3ManifestKey,
          bsOptions.vars.manifestPath
        ).then(
          () => {
            return resolve(bsOptions);
          },
          err => {
            return reject(err);
          }
        );
      } else {
        return resolve(bsOptions);
      }
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
module.exports = {
  uploadBaselineToS3,
  uploadTestDiffToS3OnMismatch,
  downloadBaselineFromS3,
  downloadManifestFromS3,
  updateManifest,
  uploadManifestS3
};
