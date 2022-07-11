## Split! ##

**Great news! The extension now has a new maintainer and will be supported open-source at https://github.com/microsoft/azure-boards-split! Please use the new repository for contributions and issues.**

#### Customizing this extension ####

This extension does a best effort to copy relevant information - including Title, AssignedTo, AreaPath, Description and any required fields. You may want additional custom fields to copy on split. We cannot support everyone's custom configuration, so we've tried to make it easy to clone this repo and create your own version of this extension. 

If you think your change would benefit others - please contribute to the master extension! 

### Structure ###

```
/scripts            - Typescript code for extension
/img                - Image assets for extension and description
/css                - Style assets for extension
/typings            - Typescript typings

details.md          - Description to be shown in marketplace   
index.html          - Main entry point
dialog.html         - Dialog html
vss-extension.json  - Extension manifest
```
#### Grunt ####

Three basic `grunt` tasks are defined:

* `build` - Compiles TS files in `scripts` folder
* `package` - Builds the vsix package
* `publishLocal` - Publishes the extension to your local box marketplace using `tfx-cli`

Note: To avoid `tfx` prompting for your token when publishing, login in beforehand using `tfx login` and the service uri of ` https://app.market.visualstudio.com`.

#### Setup for custom extensions ####

1. Run npm install 
2. Look for "Hello custom extension author" for common extension customization points
3. Change the publisher in the vss-extension.json
4. grunt build
5. grunt package
6. Upload to your on-prem instance via http://myAzureDevopsServer/_gallery/manage

#### VS Code ####

The included `.vscode` config allows you to open and build the project using [VS Code](https://code.visualstudio.com/).
