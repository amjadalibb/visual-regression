const fse = require('fs-extra');
const path = require('path');

const appDirectory = fse.realpathSync(process.cwd());

const assertPath = requiredPath => {
  if (!fse.existsSync(requiredPath)) {
    throw new Error(`Unable to find expected path ${requiredPath}.`);
    process.exit(1);
  }
  return requiredPath;
};

const resolveAppOptional = appPath => path.resolve(appDirectory, appPath);

const resolveAppRequired = appPath => assertPath(resolveAppOptional(appPath));

const resolveOwn = relativePath =>
  assertPath(path.resolve(__dirname, '../../', relativePath));

module.exports = {
  resolveAppRequired,
  resolveAppOptional,
  resolveOwn
};
