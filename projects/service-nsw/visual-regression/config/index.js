module.exports = {
  appName: 'Service NSW',
  testTitle: 'Service NSW Tests',
  baseURL: 'https://www.service.nsw.gov.au',
  endPoint: '/<type>/<label>',
  test: {
    category: [
      {
        label: 'business-trade',
        script: 'return document.readyState;'
      }
    ]
  },
  bsOptions: {
    vars: {
      testFolder: '../service-nsw/visual-regression/results/screenshots/test',
      baselineFolder:
        '../service-nsw/visual-regression/results/screenshots/baseline',
      diffFolder: '../service-nsw/visual-regression/results/screenshots/diff',
      misMatchtolerance: 0.01,
      optimizeImage: false,
      maxScroll: 20,
      waitSecondsBeforeScreenShot: '2',
      waitAfterScroll: '500', //This is milliseconds
      s3Bucket: '', // Path to store images on S3 Bucket
      developBuildTag: '', // Bamboo build tag to integrate with job
      featureBuildTag: '', // Bamboo feature tag to integrate with branch
      headless: {
        viewportWidth: 1400 // emulateDevice: 'iPhone 6' // Use viewportWidth or emulateDevice. Complete list of devices: https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js // waitSecondsBeforeScreenShot: '2', // Wait for number of seconds after page is loaded
      }
    },
    environments: [
      {
        label: 'win7_chrome',
        browserName: 'Chrome',
        os: 'Windows',
        os_version: '7',
        resolution: '1024x768'
      },
      {
        label: 'win10_chrome',
        browserName: 'Chrome',
        os: 'Windows',
        os_version: '10',
        resolution: '2048x1536',
        'browserstack.local': true
      },
      {
        label: 'win10_ie_11',
        browserName: 'IE',
        browser_version: '11',
        os: 'Windows',
        os_version: '10',
        resolution: '1024x768',
        requireScroll: false,
        addMisMatchtolerance: '100',
        'browserstack.local': true
      },
      {
        label: 'win10_firefox',
        browserName: 'firefox',
        os: 'Windows',
        os_version: '10',
        resolution: '2048x1536',
        waitAfterScroll: '500',
        'browserstack.local': true
      },
      {
        label: 'win10_edge_15',
        browserName: 'edge',
        browser_version: '15',
        os: 'Windows',
        os_version: '10',
        resolution: '1024x768',
        addMisMatchtolerance: '0.1',
        'browserstack.local': true
      },
      {
        label: 'iphone7_safari',
        browserName: 'Safari',
        device: 'iPhone 7',
        'browserstack.local': true,
        realMobile: true,
        waitSecondsBeforeScreenShot: '3',
        cropImage: {
          top: 140,
          bottom: 90
        }
      },
      {
        label: 'galaxy_s8_android',
        device: 'Samsung Galaxy S8',
        browserName: 'android',
        waitSecondsBeforeScreenShot: '3',
        'browserstack.local': true,
        realMobile: true
      },
      {
        label: 'ipadpro_safari',
        browserName: 'Safari',
        device: 'iPad Pro',
        'browserstack.local': true,
        realMobile: true,
        cropImage: {
          top: 140
        }
      },
      {
        label: 'mac_sierra_safari',
        browserName: 'Safari',
        os: 'OS X',
        os_version: 'Sierra',
        resolution: '1024x768',
        requireScroll: false,
        'browserstack.local': true
      },
      {
        label: 'mac_elcapitan_chrome',
        browserName: 'Chrome',
        os: 'OS X',
        os_version: 'El Capitan',
        resolution: '1024x768',
        waitAfterScroll: '500', //This is milliseconds
        'browserstack.local': true
      },
      {
        label: 'mac_lion_firefox',
        browserName: 'Firefox',
        os: 'OS X',
        os_version: 'Lion',
        resolution: '1024x768',
        requireScroll: false,
        'browserstack.local': true
      },
      {
        label: 'iphone_x_safari',
        browserName: 'Safari',
        device: 'iPhone X',
        'browserstack.local': true,
        realMobile: true,
        waitSecondsBeforeScreenShot: '2',
        addMisMatchtolerance: '5',
        cropImage: {
          top: 290,
          bottom: 250
        }
      },
      {
        label: 'iphone_8_safari',
        browserName: 'Safari',
        device: 'iPhone 8',
        'browserstack.local': true,
        realMobile: true,
        waitSecondsBeforeScreenShot: '2',
        addMisMatchtolerance: '5',
        cropImage: {
          top: 140,
          bottom: 90
        }
      }
    ]
  }
};
