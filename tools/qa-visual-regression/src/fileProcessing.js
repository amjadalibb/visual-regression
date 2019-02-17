const fse = require('fs-extra');
const path = require('path');
var zipdir = require('zip-dir');

const {
  resolveAppOptional,
  resolveAppRequired,
  resolveOwn
} = require('./resolve');

const { LOG } = require('./fixtures');
/* 
* It checks if path exists 
* @fPath {string} This contains the path to check
*/
function checkPath(fPath) {
  return fse.existsSync(fPath);
}
/* 
* It joins the path with the directory
* @base {string} It is suppose to have the complete path
* @dirName {string} It is the name of directory to join with base path
* It returns full path starting from root upto dirName
*/
function pathJoinerOptional(base, dirName) {
  return path.join(resolveAppOptional(base), dirName);
}
/*
* It joins the path with the directory
* @base {string} It is path to join with
* @dirName {string} It is the name of directory to join with base path
* It does not return the full path (like pathJoinerOptional) but instead joins the two provided paths
*/
function pathJoiner(base, dirName) {
  return path.join(base, dirName);
}
/* 
* It returns base path of the file path
* @fpath {string} It is the file path
*/
function getDirName(fpath) {
  return path.dirname(fpath);
}
/* 
* It creates folder if it doesn't exist
* @fpath {string} It is the path of folder
*/
function createFolder(fPath, cb) {
  if (!checkPath(fPath)) {
    LOG.FULL && console.log('Creating folder :' + fPath);
    fse.ensureDir(fPath, err => {
      if (err) throw new Error('Error createFolder: ' + err);
      cb();
    });
  } else {
    LOG.FULL && console.log('Folder already exist:' + fPath);
    cb();
  }
}

function createFile(fPath, cb) {
  if (!checkPath(fPath)) {
    LOG.FULL && console.log('Creating File :' + fPath);
    fse.ensureFile(fPath, err => {
      if (err) throw new Error('Error createFile: ' + err);
      cb();
    });
  } else {
    LOG.FULL && console.log('File already exist:' + fPath);
    cb();
  }
}
/* 
* It removes file if it exists
* @fpath {string} It is the path of file
*/
function removePath(fPath, cb) {
  try {
    LOG.FULL && console.log('Checking:' + fPath);
    if (checkPath(fPath)) {
      LOG.FULL && console.log('Removing:' + fPath);
      fse.remove(fPath, err => {
        if (err) {
          throw new Error('Error removePath: ' + err);
        } else {
          LOG.FULL && console.log('Path removed');
          cb();
        }
      });
    } else {
      LOG.FULL && console.log('Path not present (continuing): ' + fPath);
      cb();
    }
  } catch (err) {
    LOG.FULL && console.log(err);
    cb();
  }
}
/* 
* It archives the directory and create a file with "<dirName>-archive.zip". It is used at the end of script to archive temp folder.
* The archived file can further be used as an artefact on CI/CD
* @dir {string} It is the path to archive
*/
const archive = dir =>
  new Promise((resolve, reject) => {
    LOG.FULL && console.time('Archive Time');
    LOG.FULL && console.log('Archiving now');
    const directory = getDirName(resolveAppOptional(dir));
    LOG.FULL && console.log('Folder Archiving: ' + directory);
    if (checkPath(directory)) {
      var file = path.join(
        getDirName(directory),
        path.basename(directory) + '-archive.zip'
      );
      removePath(file, () => {
        zipdir(directory, { saveTo: file }, function(err, buffer) {
          LOG.FULL && console.log('Archive Completed !');
          LOG.FULL && console.timeEnd('Archive Time');
          return resolve();
        });
      });
    } else {
      LOG.FULL && console.log("Path doesn't exist " + directory);
      return reject("Path doesn't exist " + directory);
    }
  });
/* 
* It writes the JSON to path.
*/
const writeJSON = (jsonData, path) =>
  new Promise((resolve, reject) => {
    removePath(path, () => {
      createFile(path, () => {
        fse.writeFile(path, JSON.stringify(jsonData), function(err) {
          if (err) {
            LOG.FULL && console.log(err);
            return reject(err);
          } else {
            LOG.FULL && console.log('File saved: ' + path);
            return resolve();
          }
        });
      });
    });
  });

module.exports = {
  createFolder,
  removePath,
  checkPath,
  pathJoiner,
  getDirName,
  pathJoinerOptional,
  archive,
  resolveAppRequired,
  resolveAppOptional,
  resolveOwn,
  writeJSON
};
