/* 
* This module is responsible for all image processing tasks (crop, merge, compare, optimize, load and save image)
*/
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const { RESULT, LOG } = require('./fixtures');
const path = require('path');
const resemble = require('node-resemble-js');
const fse = require('fs-extra');
const {
  removePath,
  createFolder,
  checkPath,
  getDirName
} = require('./fileProcessing');
const images = require('images');

images.setLimit(10000, 1000000);
/* 
* It is used for optimizing the image. It probably uses some random mechanism to optimize the image so therefore, comparing with baseline screenshot will be slightly different on some pixels
* Third party library imagemin and imagemin-pngquant is used for optimization
* @filePath {string} It is the path of image (jpeg or png) to optimize
* Returns resolve promise if it is passed, otherwise rejects promise
*/
const optimizeImage = filePath =>
  new Promise((resolve, reject) => {
    try {
      imagemin([filePath], getDirName(filePath), {
        use: [imageminPngquant({ nofs: true })]
      })
        .then(() => {
          LOG.FULL && console.log('Optimized screenshot: ' + filePath);
          return resolve(true);
        })
        .catch(() => {
          LOG.FULL && console.log('Failed to optimize screenshot: ' + filePath);
          return resolve(true);
        });
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* It compares baseline screenshot with new screenshot and returns result with mismatch percentage. It would save the diff image (as jpeg) only if there is a mismatch
* @bsOptions {object} It contains two screenshot files (screenFile and refFile) to compare. It also has directory and file path (diffFolder, diffFile) for a diff image
* #bsOptions.vars.misMatchtolerance {number} It is the tolerance value for mismatch
* #data.misMatchPercentage {number} It is the actual mismatch value after comparision
* #bsOptions.vars.result {number} Comparing images process will only run if baseline image is NOT updated
*/
const compareImages = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.FULL && console.log('Comparing Images Now ...');
      if (bsOptions.vars.result === RESULT.SCREEN_UPDATED) {
        LOG.FULL && console.time('Compare Images');
        var diff = resemble(bsOptions.vars.screenFile)
          .compareTo(bsOptions.vars.refFile)
          .onComplete(data => {
            LOG.INFO &&
              console.log(
                'Actual mismatchPercentage: ' +
                  data.misMatchPercentage +
                  ' Mismatchtolerance: ' +
                  bsOptions.vars.misMatchtolerance
              );
            if (
              Number(data.misMatchPercentage) <=
              bsOptions.vars.misMatchtolerance
            ) {
              LOG.FULL && console.log('Images Matched !');
              bsOptions.vars.result = RESULT.MATCHED;
              bsOptions.vars.misMatchPercentage = data.misMatchPercentage;
              LOG.FULL && console.timeEnd('Compare Images');
              return resolve(bsOptions);
            } else {
              createFolder(bsOptions.vars.diffFolder, () => {
                removePath(bsOptions.vars.diffFile, () => {
                  const buffer = data.getDiffImageAsJPEG(20);
                  fse.writeFileSync(bsOptions.vars.diffFile, buffer, null);
                  LOG.FULL && console.timeEnd('Compare Images');
                  LOG.FULL &&
                    console.log('Creating diff : ' + bsOptions.vars.diffFile);
                  bsOptions.vars.result = RESULT.MISMATCH;
                  bsOptions.vars.misMatchPercentage = data.misMatchPercentage;
                  return resolve(bsOptions);
                });
              });
            }
          });
      } else return resolve(bsOptions);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* It loads the image in object and returns with a promise, otherwise reject with error message
* It is using third party library "images" to process images (e.g. crop, merge, etc.)
* @imgPath {string} This is the path of image to load in object
*/
const loadOneImage = imgPath =>
  new Promise((resolve, reject) => {
    try {
      if (checkPath(imgPath)) return resolve(images(imgPath));
      else return reject(`Image does not exist: ${imgPath}`);
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* It will crop the image as defined in config for the browser. Uncropped image is the screenshot of phone and has some unncessary areas that needs a crop (i.e. time on top, browser buttons, address bar, etc) 
* For example, below browser require screenshot to crop 192 lines from top and 130 lines from bottom
  {
    label: 'iphone7plus_safari',
    browserName: 'Safari',
    device: 'iPhone 7 Plus',
    'browserstack.local': 'true',
    realMobile: 'true',
    waitSecondsBeforeScreenShot: '2',
    cropImage: {
      top: 192,
      bottom: 130
    }
  }
* @img {object} is the image object to crop
* @cropTop {number} is the number of lines to crop from top
* @cropBottom {number} is the number of lines to crop from bottom
* It returns a cropped image object
*/
const cropOneImg = (img, cropTop, cropBottom) =>
  new Promise(async (resolve, reject) => {
    return resolve(
      await images(
        img,
        0,
        cropTop,
        img.width(),
        img.height() - cropTop - cropBottom
      )
    );
  });
/* 
* It merges 2 images
* @oldImage {object} It is the base image object
* @newImage {object} It is the new image to merge
* It returns merged image object
*/
const mergeTwoImages = (oldImg, newImg) =>
  new Promise(async (resolve, reject) => {
    var baseImg = await images(
      oldImg.width(),
      oldImg.height() + newImg.height()
    );
    await baseImg.draw(oldImg, 0, 0).draw(newImg, 0, oldImg.height());
    return resolve(baseImg);
  });

const saveOneImg = (img, path) =>
  new Promise(async (resolve, reject) => {
    await img.save(path);
    return resolve();
  });

/*
* This will load new image, crop and merge with base image
* @newImagePath {string} It is path of the new downloaded image
* @baseImg {object} It is object of base image
* @cropTop {number} It is number of lines to crop from top
* @cropBottom {number} It is number of lines to crop from bottom
* It returns base image object
*/
const cropMerge = (newImagePath, baseImg, cropTop, cropBottom) =>
  new Promise((resolve, reject) => {
    try {
      loadOneImage(newImagePath).then(
        newImg => {
          removePath(newImagePath, () => {
            cropOneImg(newImg, cropTop, cropBottom).then(croppedNewImg => {
              if (!baseImg) {
                return resolve(croppedNewImg);
              } else {
                mergeTwoImages(baseImg, croppedNewImg).then(mergedImages => {
                  return resolve(mergedImages);
                });
              }
            });
          });
        },
        err => {
          LOG.FULL && console.log(err);
          return reject(err);
        }
      );
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

/* 
* This will traverse through downloaded images then initiate crop and merge with base image
* @downloadedImages {array} It is an array of downloaded image paths
* @baseImg {object} It is object of base image
* @index {number} It is an index at the downloaded image array
* It returns a base image object in a resolve promise
* Note: I have tried with for loop but it did't give the expected behavior so I switched it to recursive mode. 
* It will ensure that an images are cropped and merged before it starts operation on next downloaded image.
*/
const recursiveMerge = (
  downloadedImages,
  baseImg,
  index,
  cropTop,
  cropBottom
) =>
  new Promise((resolve, reject) => {
    try {
      cropMerge(downloadedImages[index], baseImg, cropTop, cropBottom).then(
        newBaseImg => {
          if (index === downloadedImages.length - 1) {
            return resolve(newBaseImg);
          } else {
            index++;
            recursiveMerge(
              downloadedImages,
              newBaseImg,
              index,
              cropTop,
              cropBottom
            ).then(newBaseImg => {
              return resolve(newBaseImg);
            });
          }
        }
      );
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });
/* 
* It initiates merge of all images and then save base image to defined path
* @bsOptions {object} It contains information of cropImage (top and bottom)
* #bsOptions.vars.processFile {string} It has a path to store the image after processing
*/
const mergeAllImages = bsOptions =>
  new Promise((resolve, reject) => {
    try {
      LOG.FULL && console.time('Merge All Images');
      const { top: cropTop = 0, bottom: cropBottom = 0 } = bsOptions.vars
        .browsers.cropImage || { top: 0, bottom: 0 };
      recursiveMerge(
        bsOptions.vars.downloadedImages,
        undefined,
        0,
        cropTop,
        cropBottom
      ).then(
        newBaseImg => {
          saveOneImg(newBaseImg, bsOptions.vars.processFile).then(() => {
            LOG.FULL && console.timeEnd('Merge All Images');
            LOG.FULL &&
              console.log(`All Images Merged ${bsOptions.vars.processFile}`);
            return resolve(bsOptions);
          });
        },
        err => {
          return reject(err);
        }
      );
    } catch (err) {
      LOG.FULL && console.log(err);
      return reject(err);
    }
  });

module.exports = {
  loadOneImage,
  optimizeImage,
  compareImages,
  mergeAllImages
};
