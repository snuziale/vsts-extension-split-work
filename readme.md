## Split! ##

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
* `publish` - Publishes the extension to the marketplace using `tfx-cli`

Note: To avoid `tfx` prompting for your token when publishing, login in beforehand using `tfx login` and the service uri of ` https://app.market.visualstudio.com`.

#### Including framework modules ####

The VSTS framework is setup to initialize the requirejs AMD loader, so just use `import Foo = require("foo")` to include framework modules.

#### VS Code ####

The included `.vscode` config allows you to open and build the project using [VS Code](https://code.visualstudio.com/).
