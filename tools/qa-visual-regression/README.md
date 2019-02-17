# Visual Regression Test

This helps identify visual UI differences between previous and current pages. Test can run on both headless and non-headless modes (browserstack).

## Configuration

To be able to run visual regression with any web application, some configuration is required:

### Environment Variables

Create `.env` file under the root of web application project and add below variables

| Name                       | Value            | Description                                                                                   |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `BROWSERSTACK_USERNAME`    | `username`       | Browserstack Username used to launch device. Contact QA for relavant Browserstack Credentials |
| `BROWSERSTACK_KEY`         | `somekey`        | BrowserStack key for visual and screenshot tests                                              |
| `BUILD_KEY`                | `some value`     | Key is required to create new directory on S3 bucket for screenshots                          |
| `STORYBOOK_URL`            | `base url`       | This is base url of web application                                                           |
| `VISUAL_REGRESSION_LOG`    | `1,2 or 3`       | Info = 1, Debug = 2, Full = 2                                                                 |
| `VISUAL_REGRESSION_CONFIG` | `path of config` | Path of visual regression config. Default value: `visual-regression/config/index.js`          |

### AWS Authentication on CLI

- CLI needs AWS authentication to upload / download objects to / from S3. If you don't want to use S3 then AWS authentication is not required.

## Headless Tests

Headless tests run faster than non-headless because they don't require any device or browser to launch.

Navigate to directory (../projects/applications/"project"), then run following command:

```
// execute headless test
npm run visual-regression -- --headless
// or
npm run headless -- --name "name of test"

// execute headless test and download and upload baseline from s3
npm run headless -- --name "name of test" --downloads3 --uploads3 --uploads3onmismatch

// execute headless test and download and upload baseline from directory on s3
npm run headless -- --name "name of test" --downloads3 --uploads3 --uploads3onmismatch --buildkey "Build name"
```

### Arguments

Below are the supporting arguments for Headless mode:

| Argument               | Value               | Description                                                                                                                       |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--headless`           | n/a                 | Runs test in headless mode                                                                                                        |
| `--name`               | `some name of test` | Runs only provided tests (single or multiple). Check visual regression config file for name of test (e.g. label)                  |
| `--update`             | n/a                 | Updates all baseline screenshot                                                                                                   |
| `BUILD_KEY`            | `some value`        | Key is required to create new directory on S3 bucket for screenshots                                                              |
| `--vrconfig`           | `path of config`    | Loads visual regression config. Default value: `visual-regression/config/index.js`                                                |
| `--downloads3`         | n/a                 | Downloads baseline screenshot from s3 before execution                                                                            |
| `--uploads3`           | n/a                 | Uploads baseline screenshot to s3 after execution. It works only if screenshot doesn't exist on s3 or `--update` argument is used |
| `--uploads3onmismatch` | n/a                 | Uploads baseline screenshot to s3 only if mismatch occurs                                                                         |

### Testing Multiple Pages

You can test multiple page URLs by passing a string of comma separated IDs, for example

```
npm run visual-regression -- --name "test1, test2" --headless
```

### Change View Port Settings

Change page view port. For example, to use page view port width 1600, add/modify below code inside `bsOptions.vars` of visual regression config. Default viewport width is 800

```
headless: {
  viewportWidth: 1600
}
```

Puppeteer emulators can also be used. For example, to use `iPhone 6` device settings, add / modify below code inside `bsOptions.vars` of visual regression config. List of puppeteer devices can be found here https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js

```
headless: {
  emulateDevice: 'iPhone 6'
}
```

View port can also be for each test separately and it will override default viewport settings.

```
{
  label: 'test1',
  headless: {
    viewportWidth: 1600
    // OR
    emulateDevice: 'iPhone 6'
  }
},
```

Note: `emulateDevice` will override `viewportWidth` and viewport settings within test will always take precedence on default

## Browser Tests

To run tests on device and browser in browserstack, simply add `--env` in command line argument and then paste label of browser that is mentioned in config.

Navigate to directory (../projects/applications/projectname), then run following command to run all tests against all browsers:

```
npm run visual-regression
```

### Arguments

Below are the supporting arguments for Headless mode:

| Argument               | Value               | Description                                                                                                                                    |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--name`               | `one/more test`     | Runs only provided tests (single or multiple). Check visual regression config file for name of test (e.g. label). Default: Run all tests       |
| `--env`                | `one/more browsers` | Runs test in mentioned device / browsers only. See visual regression config of web project to see label of browsers. Default: Run all browsers |
| `--update`             | n/a                 | Updates all baseline screenshot                                                                                                                |
| `--local`              | n/a                 | Force browserstack local to launch. If browser includes `browserstack.local=true` then there is no need to put this argument in commandline.   |
| `--vrconfig`           | `path of config`    | Loads visual regression config. Default value: `visual-regression/config/index.js`                                                             |
| `--downloads3`         | n/a                 | Downloads baseline screenshot from s3 before execution                                                                                         |
| `--uploads3`           | n/a                 | Uploads baseline screenshot to s3 after execution. It works only if screenshot doesn't exist on s3 or `--update` argument is used              |
| `--uploads3onmismatch` | n/a                 | Uploads baseline screenshot to s3 only if mismatch occurs                                                                                      |
| `--dontflag`           | n/a                 | Flag all the tests as passed but still save diff files                                                                                         |

### Testing Specific Pages Or Browsers

You can test multiple page URLs by passing a string of comma separated IDs, for example

```
npm run visual-regression -- --name "test1, test2"
```

You can test specific page URL against multiple browsers by passing a string of comma separated browserIDs, for example

```
npm run visual-regression -- --name "test1" --env "iphone7plus_safari, galaxys6_chrome"
```

## Notes

- First time, it will update reference directory with baseline screenshots (named as "headless.png") and second time it will compare with it.

- All screenshots can be downloaded / uploaded to S3 bucket, simply add `--downloads3`, `--uploads3` or `--uploads3onmismatch` arguments in commandline. It needs AWS authentication on CLI. Need to contact with DevOps.

## Things to remember

1. After cloning fresh repository, add `.env` file and environment variables `STORYBOOK_URL`, `BROWSERSTACK_USERNAME`, `BROWSERSTACK_KEY`
2. If there is no name or environment provided in command then script will run for all tests or environments within config.
3. Command should run within directory where visual regression config exists (e.g. service-now)
4. You need AWS access on CLI to be able to download / upload image to s3.
