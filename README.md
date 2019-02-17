### Visual Regression Framework Setup

Visual regression framework helps UI based applications for quick visual regression testing. The visual regression can assist identify UI changes due to regression e.g. CSS change and UI Element Movement, etc.

Computers are actually pretty good at spotting differences between images. Because they compare data (instead of the visual representation of that data) they can easily compare the values of two images to spot differences between them. Here's an example:

![](https://learn.visualregressiontesting.com/images/example.png)

# Instructions to Setup

- Create new directory under projects
- Create package.json and copy below code

```
	{
  	"name": "PROJECT-NAME",
  	"version": "1.0.0",
  	"description": "",
  	"main": "index.js",
  	"scripts": {
    	"visual-regression": "../scripts/scripts.js visual",
    	"headless": "../scripts/scripts.js visual -- --headless"
  	},
  	"author": "",
  	"license": "ISC",
  	"jest": {
    	"verbose": true,
    	"testURL": "http://localhost/"
  	}
	}
```

- Create visual.spec.js and copy below code

```
const visualReg = require('../../tools/qa-visual-regression');
visualReg.start();
```

- Create .env in project directory and add environment variables

```
BROWSERSTACK_USERNAME=
BROWSERSTACK_KEY=
VISUAL_REGRESSION_LOG=3
BUILD_KEY=
STORYBOOK_URL=http://localhost:9001/
```

- Create directory visual-regression/config/

- Create config file index.js in visual-regression/config/, copy below code and replace value anything with < >, e.g. "< type >, < label >, < project-dirname >"

```
module.exports = {
  appName: '',
  testTitle: '',
  baseURL: 'https://www.service.nsw.gov.au/',
  endPoint: '<type>/<label>',
  test:
 	{
    	<type>: [
      	{
       	 label: '<label>'
     	 }
    	],
	bsOptions: {
    	vars: {
      	testFolder: '../<project-dirname>/visual-regression/results/screenshots/test',
      	baselineFolder: '../<project-dirname>/visual-regression/results/screenshots/baseline',
      	diffFolder: '../<project-dirname>/visual-regression/results/screenshots/diff',
      	misMatchtolerance: 0.01,
      	optimizeImage: false,
      	maxScroll: 20,
      	waitSecondsBeforeScreenShot: '2',
      	waitAfterScroll: '500', //This is milliseconds
      	s3Bucket: 'path/<project-dirname>',
      	developBuildTag: '<project-dirname>-develop',
      	featureBuildTag: '<project-dirname>-feature',
      	headless: {
        	viewportWidth: 1400
        	// emulateDevice: 'iPhone 6' // Use viewportWidth or emulateDevice. Complete list of devices: https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js
        	// waitSecondsBeforeScreenShot: '2', // Wait for number of seconds after page is loaded
      	}
    	},
	},
	environments: [
		{
        	label: 'win7_chrome',
        	browserName: 'Chrome',
        	os: 'Windows',
        	os_version: '7',
        	resolution: '1024x768',
        	'browserstack.local': true
     	}
	]
  }
}

```

- Install all dependencies , run below command from root of repo

```
npm run bootstrap
```

- To uninstall all dependencies , run below command from root of repo

```
npm run clean
```

- Run automation test with Browserstack, run below command from directory /projects/< project-name >/

```
npm run visual-regression -- --name "<label>,<label>" --env "win7_chrome"
```

- Run automation test with headless

```
npm run headless -- --name "<label>,<label>"
```
