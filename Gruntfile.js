/**
 * Gruntfile.js adapted from existing file created by Web IDE and
 * sap blog on using babel in Web IDE:
 * https://blogs.sap.com/2017/11/01/next-generation-javascript-in-ui5-using-sap-web-ide/
 */
 

module.exports = function (grunt) {
	"use strict";
	var webAppDir = "webapp";
	var targetDir = "dist";
	var tmpDir = targetDir + "/tmp";
	var tmpDirDbg = targetDir + "/tmp-dbg";
	var tmpDirBabel = targetDir + "/tmp-babel";	

	var config = {
		coverage_threshold: { // eslint-disable-line camelcase
			statements: 0,
			branches: 100,
			functions: 0,
			lines: 0
		},
		babel: {
			options: {
				sourceMap: false,
				presets: ["@babel/preset-env"]
			},
			dist: {
				files: [{
					expand: true, // Enable dynamic expansion.
					cwd: "webapp/", // Src matches are relative to this path.
					src: ["**/*.js"],
					dest: tmpDirBabel, // Destination path prefix.
					//ext: ".js",   // Dest filepaths will have this extension.
					//extDot: "first",   // Extensions in filenames begin after the first dot
					filter: function(filepath) {
						return !filepath.match(new RegExp("webapp/libs", "gi"));
					}
				}]
			}
		},
		clean: {
			build: [targetDir],
			cleanBabel: [tmpDirBabel]
		},
		copy: {
			copyToDbg: {
				files: [{
					expand: true,
					src: "**/*.js",
					dest: tmpDirDbg,
					cwd: tmpDirBabel,
					filter: function(filepath) {
						// prevent js from localService to be copied
						return !filepath.match(new RegExp(webAppDir + "(\\/|\\\\)localService", "gi"));
					}
				}, {
					expand: true,
					src: "libs/**/*.js",
					dest: tmpDir,
					cwd: webAppDir
				}, {
					expand: true,
					src: "**/*.css",
					dest: tmpDirDbg,
					cwd: webAppDir
				}]
			},
			copyToTmp: {
				files: [{
					expand: true,
					src: "**/*.js",
					dest: tmpDir,
					cwd: tmpDirBabel,
					filter: function(filepath) {
						// prevent js from localService to be copied
						return !filepath.match(new RegExp("build" + "(\\/|\\\\)localService", "gi"));
					}
				}, {
					expand: true,
					src: "libs/**/*.js",
					dest: tmpDir,
					cwd: webAppDir
				}, {
					expand: true,
					src: "**/*.css",
					dest: tmpDir,
					cwd: webAppDir
				}, {
					expand: true,
					src: "localService/metadata.xml",
					dest: tmpDir,
					cwd: webAppDir
				}, {
					expand: true,
					src: "**/*",
					dest: tmpDir,
					cwd: webAppDir,
					filter: function(filepath) {
						// prevent js and css files and contents of webapp/test from being copied
						return !filepath.match(new RegExp("(" + webAppDir +
							"(\\/|\\\\)test|${webAppDir}(\\/|\\\\)localService|\\.js$|\\.css$|\\.ts$|\\test.html$)", "gi"));
					}
				}]
			}
		}
	};	
	
	grunt.loadNpmTasks("grunt-babel");
	grunt.loadNpmTasks("@sap/grunt-sapui5-bestpractice-build");
	grunt.config.merge(config);
	grunt.registerTask("default", "runs my tasks", function() {
		var tasks = [
			"clean:build",
			"babel",
			"build",
			"lint",
			"clean:cleanBabel"
		];
		
		// Use the force option for all tasks declared in the previous line
		// grunt.option("force", true);
		grunt.option("stack", true);
		grunt.task.run(tasks);
	});
	grunt.loadNpmTasks("@sap/grunt-sapui5-bestpractice-test");
	grunt.registerTask("unit_and_integration_tests", ["test"]);
};