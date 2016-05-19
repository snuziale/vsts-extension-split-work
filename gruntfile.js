module.exports = function (grunt) {
    grunt.initConfig({
        ts: {
            build: {
                src: ["scripts/**/*.ts", "scripts/**/*.tsx"],
                tsconfig: true
            },
            options: {
                fast: 'never'
            }
        },
        exec: {
            package: {
                command: "tfx extension create --manifest-globs vss-extension.json",
                stdout: true,
                stderr: true
            },
            publish: {
                command: "tfx extension publish --manifest-globs vss-extension.json",
                stdout: true,
                stderr: true
            },
            publishlocal: {
                command: "tfx extension publish --manifest-globs vss-extension.json --service-url http://localhost:8080/tfs/",
                stdout: true,
                stderr: true
            }
        },
        copy: {
            scripts: {
                files: [{
                    expand: true,
                    flatten: true,
                    src: ["node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js"],
                    dest: "scripts",
                    filter: "isFile"
                }]
            }
        },

        clean: ["scripts/**/*.js", "*.vsix", "dist"]
    });

    grunt.loadNpmTasks("grunt-ts");
    grunt.loadNpmTasks("grunt-exec");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask("build", ["ts:build", "copy:scripts"]);
    grunt.registerTask("package", ["build", "exec:package"]);
    grunt.registerTask("publish", ["default", "exec:publishlocal"]);

    grunt.registerTask("default", ["package"]);
};