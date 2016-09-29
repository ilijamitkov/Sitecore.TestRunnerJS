(function () {
  var Reporter, USAGE, config, fs, mocha, reporter, system, webpage,
    __bind = function (fn, me) { return function () { return fn.apply(me, arguments); }; };

  system = require('system');

  webpage = require('webpage');

  fs = require('fs');

  USAGE = "Usage: phantomjs loader.js instance_name application_name [-r report_path] [-t macha_load_timeout]";

  Reporter = (function () {
    function Reporter(config, url) {
      this.reporter = config.reporter;
      this.config = config;
      this.checkStarted = __bind(this.checkStarted, this);
      this.waitForRunMocha = __bind(this.waitForRunMocha, this);
      this.waitForInitMocha = __bind(this.waitForInitMocha, this);
      this.waitForMocha = __bind(this.waitForMocha, this);
      this.url = url;
      this.columns = parseInt(system.env.COLUMNS || 75) * .75 | 0;
      this.mochaStartWait = this.config.timeout;
      this.startTime = Date.now();
      this.output = this.config.file ? fs.open(this.config.file, 'w') : system.stdout;
      this.testsComplete = false;
      this.testResults = null;
      if (!this.url) {
        this.fail(USAGE);
      }
    }

    Reporter.prototype.run = function (page) {
      this.page = page;
      this.initPage();
      return this.loadPage();
    };

    Reporter.prototype.customizeMocha = function (options) {
      return Mocha.reporters.Base.window.width = options.columns;
    };

    Reporter.prototype.customizeOptions = function () {
      return {
        columns: this.columns
      };
    };

    Reporter.prototype.fail = function (msg, errno) {
      if (this.output && this.config.file) {
        this.output.close();
      }
      if (msg) {
        console.log(msg);
      }
      this.testsComplete = true;
      throw { message: msg, code: errno };
      //return phantom.exit(errno || 1);
    };

    Reporter.prototype.finish = function () {
      if (this.config.file) {
        this.output.close();
      }
      this.testsComplete = true;
      this.testResults = this.page.evaluate(function () {
        return mochaPhantomJS.stats;
      });

      //return phantom.exit(this.page.evaluate(function () {
      //  return mochaPhantomJS.failures;
      //}));
    };

    Reporter.prototype.initPage = function () {
      var cookie, _i, _len, _ref;
      this.page = webpage.create({
        settings: this.config.settings
      });
      if (this.config.headers) {
        this.page.customHeaders = this.config.headers;
      }
      _ref = this.config.cookies || [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cookie = _ref[_i];
        this.page.addCookie(cookie);
      }
      if (this.config.viewportSize) {
        this.page.viewportSize = this.config.viewportSize;
      }

      var verbose = this.config.verbose;
      this.page.onConsoleMessage = function (msg) {
        if (verbose) {
          return system.stdout.writeLine(msg);
        } else {
          var testLabel = "#[TEST]#";
          if (msg.substring(0, testLabel.length) === testLabel) {
            return system.stdout.writeLine(msg.substring(testLabel.length));
          }
        }
      };

      this.page.onResourceError = (function (_this) {
        return function (resErr) {
          if (!_this.config.ignoreResourceErrors) {
            return system.stdout.writeLine("Error loading resource " + resErr.url + " (" + resErr.errorCode + "). Details: " + resErr.errorString);
          }
        };
      })(this);
      this.page.onError = (function (_this) {
        return function (msg, traces) {
          var file, index, line, _j, _len1, _ref1;
          if (_this.page.evaluate(function () {
            return window.onerror != null;
          })) {
            return;
          }
          for (index = _j = 0, _len1 = traces.length; _j < _len1; index = ++_j) {
            _ref1 = traces[index], line = _ref1.line, file = _ref1.file;
            traces[index] = "  " + file + ":" + line;
          }
          return _this.fail("" + msg + "\n\n" + (traces.join('\n')));
        };
      })(this);
      return this.page.onInitialized = (function (_this) {
        return function () {
          return _this.page.evaluate(function (env) {
            return window.mochaPhantomJS = {
              env: env,
              failures: 0,
              ended: false,
              started: false,
              run: function () {
                mochaPhantomJS.runArgs = arguments;
                mochaPhantomJS.started = true;
                window.callPhantom({
                  'mochaPhantomJS.run': true
                });
                return mochaPhantomJS.runner;
              }
            };
          }, system.env);
        };
      })(this);
    };

    Reporter.prototype.loadPage = function () {
      this.page.open(this.url);
      this.page.onLoadFinished = (function (_this) {
        return function (status) {
          _this.page.onLoadFinished = function () { };
          if (status !== 'success') {
            _this.onLoadFailed();
          }
          return _this.waitForInitMocha();
        };
      })(this);
      return this.page.onCallback = (function (_this) {
        return function (data) {
          if (data != null ? data.hasOwnProperty('Mocha.process.stdout.write') : void 0) {
            _this.output.write(data['Mocha.process.stdout.write']);
          } else if (data != null ? data.hasOwnProperty('mochaPhantomJS.run') : void 0) {
            if (_this.injectJS()) {
              _this.waitForRunMocha();
            }
          } else if (typeof (data != null ? data.screenshot : void 0) === "string") {
            _this.page.render(data.screenshot + ".png");
          }
          return true;
        };
      })(this);
    };

    Reporter.prototype.onLoadFailed = function () {
      return this.fail("Failed to load the page. Check the url: " + this.url);
    };

    Reporter.prototype.injectJS = function () {
      if (this.page.evaluate(function () {
        return window.mocha != null;
      })) {
        this.page.injectJs('mocha-phantomjs/core_extensions.js');
        this.page.evaluate(this.customizeMocha, this.customizeOptions());
        return true;
      } else {
        this.fail("Failed to find mocha on the page.");
        return false;
      }
    };

    Reporter.prototype.runMocha = function () {
      var customReporter, wrappedReporter, wrapper, _base;
      this.page.evaluate(function (config) {
        mocha.useColors(config.useColors);
        mocha.bail(config.bail);
        if (config.grep) {
          mocha.grep(config.grep);
        }
        if (config.invert) {
          return mocha.invert();
        }
      }, this.config);
      if (typeof (_base = this.config.hooks).beforeStart === "function") {
        _base.beforeStart(this);
      }
      if (this.page.evaluate(this.setupReporter, this.reporter) !== true) {
        customReporter = fs.read(this.reporter);
        wrapper = function () {
          var exports, module, process, require;
          require = function (what) {
            var r;
            what = what.replace(/[^a-zA-Z0-9]/g, '');
            for (r in Mocha.reporters) {
              if (r.toLowerCase() === what) {
                return Mocha.reporters[r];
              }
            }
            throw new Error("Your custom reporter tried to require '" + what + "', but Mocha is not running in Node.js in mocha-phantomjs, so Node modules cannot be required - only other reporters");
          };
          module = {};
          exports = void 0;
          process = Mocha.process;
          'customreporter';
          return Mocha.reporters.Custom = exports || module.exports;
        };
        wrappedReporter = wrapper.toString().replace("'customreporter'", "(function() {" + (customReporter.toString()) + "})()");
        this.page.evaluate(wrappedReporter);
        if (this.page.evaluate(function () {
          return !Mocha.reporters.Custom;
        }) || this.page.evaluate(this.setupReporter) !== true) {
          this.fail("Failed to use load and use the custom reporter " + this.reporter);
        }
      }
      if (this.page.evaluate(this.runner)) {
        this.mochaRunAt = new Date().getTime();
        return this.waitForMocha();
      } else {
        return this.fail("Failed to start mocha.");
      }
    };

    Reporter.prototype.waitForMocha = function () {
      var ended, _base;
      ended = this.page.evaluate(function () {
        return mochaPhantomJS.ended;
      });
      if (ended) {
        if (typeof (_base = this.config.hooks).afterEnd === "function") {
          _base.afterEnd(this);
        }
        return this.finish();
      } else {
        return setTimeout(this.waitForMocha, 100);
      }
    };

    Reporter.prototype.waitForInitMocha = function () {
      if (!this.checkStarted()) {
        return setTimeout(this.waitForInitMocha, 100);
      }
    };

    Reporter.prototype.waitForRunMocha = function () {
      if (this.checkStarted()) {
        return this.runMocha();
      } else {
        return setTimeout(this.waitForRunMocha, 100);
      }
    };

    Reporter.prototype.checkStarted = function () {
      var started;
      started = this.page.evaluate(function () {
        return mochaPhantomJS.started;
      });
      if (!started && this.mochaStartWait && this.startTime + this.mochaStartWait < Date.now()) {
        this.fail("Failed to start mocha: Init timeout", 255);
      }
      return started;
    };

    Reporter.prototype.setupReporter = function (reporter) {
      var error;
      try {
        mocha.setup({
          reporter: reporter || Mocha.reporters.Custom
        });
        return true;
      } catch (_error) {
        error = _error;
        return error;
      }
    };

    Reporter.prototype.runner = function () {
      var cleanup, error, _ref, _ref1;
      try {
        mochaPhantomJS.runner = mocha.run.apply(mocha, mochaPhantomJS.runArgs);
        if (mochaPhantomJS.runner) {
          cleanup = function () {
            mochaPhantomJS.failures = mochaPhantomJS.runner.failures;
            return mochaPhantomJS.ended = true;
          };
          if ((_ref = mochaPhantomJS.runner) != null ? (_ref1 = _ref.stats) != null ? _ref1.end : void 0 : void 0) {
            cleanup();
          } else {
            mochaPhantomJS.runner.on('end', cleanup);
          }
        }
        return !!mochaPhantomJS.runner;
      } catch (_error) {
        error = _error;
        return false;
      }
    };

    return Reporter;

  })();

  var instanceName = system.args[1];
  console.log('Working instance: ' + instanceName);

  var applicationName = system.args[2];
  console.log('Application name: ' + applicationName);

  var minimistConfig = {
    alias: {
      t: 'timeout',
      g: 'grep',
      i: 'invert',
      r: 'reporter',
      v: 'verbose',
      u: 'url',
      o: 'outputReportPath'
    },
    boolean: [
      'invert',
      'verbose'
    ],
    default: {
      timeout: 30000,
      reporter: 'report.js'
    }
  };
  config = require('./minimist')(system.args.slice(3), minimistConfig);

  var testResults = { fail: 0, pass: 0, total: 0, details: [] };
  var startTime = (new Date()).getTime();

  if (config.url) {
    loginIntoSitecore([config.url]);
  } else {
    var settingsPage = webpage.create();
    settingsPage.open("http://" + instanceName + "/sitecore/testrunnerjs/phantom/settings.html?app=" + applicationName, function () {
      console.log('Loading test settings.');

      var testPagesResult = settingsPage.evaluate(function () {
        return testPages;
      });
      settingsPage.close();

      if (testPagesResult) {
        console.log('Test settings was loaded.');

        var pagesUnderTest = [];
        for (var i = 0; i < testPagesResult.length; i++) {
          pagesUnderTest.push(testPagesResult[i]);
        }
        loginIntoSitecore(pagesUnderTest);
      } else {
        var testPagesLocation = settingsPage.evaluate(function () {
          return testPagesLocation;
        });
        if (testPagesLocation && testPagesLocation.ExpectedPath) {
          console.log("Error loading test settings. Expected path: " + testPagesLocation.ExpectedPath);
        } else {
          console.log("Error loading test settings.");
        }
        console.log("Test execution terminated.");
        phantom.exit(1);
      }
    });
  }

  function loginIntoSitecore(pagesUnderTest) {
    var loginPageUrl = "http://" + instanceName + "/sitecore/login";
    var loginPage = webpage.create();
    loginPage.open(loginPageUrl, "post", { n: "" }, function () {
      console.log('Login page loaded! Url: ' + loginPage.url);

      loginPage.onLoadFinished = function () {
        console.log('Launch pad page loaded! Url: ' + loginPage.url);

        beginTestExecution(loginPage.cookies, pagesUnderTest);
        loginPage.close();
      };

      loginPage.evaluate(function () {
        document.getElementById("UserName").value = "admin"
        document.getElementById("Password").value = "b"
        document.getElementsByClassName("btn-primary")[0].click();
      });
    });
  }

  function beginTestExecution(loginCookies, pagesUnderTest) {
    if (phantom.version.major < 1 || (phantom.version.major === 1 && phantom.version.minor < 9)) {
      console.log('mocha-phantomjs requires PhantomJS > 1.9.1');
      phantom.exit(-1);
    }

    config.cookies = loginCookies;

    if (config.hooks) {
      config.hooks = require(config.hooks);
    } else {
      config.hooks = {};
    }

    runTestsOnPages(pagesUnderTest);
  }

  function runTestsOnPages(pagesUnderTest) {
    if (pagesUnderTest.length > 0) {
      var pageUnderTest = pagesUnderTest[0];
      var testPageUrl = "http://" + instanceName + pageUnderTest;
      pagesUnderTest.splice(0, 1);

      console.log('Testing page: ' + testPageUrl);
      var runner = new Reporter(config, testPageUrl);
      runner.run();

      waitForTestEnd(runner, pageUnderTest, function () { runTestsOnPages(pagesUnderTest); });
    } else {
      console.log('Tests execution was finished.');
      var time = (new Date()).getTime() - startTime;
      testResults.duration = time;
      console.log('Passed: ' + testResults.pass + ' Failed: ' + testResults.fail + ' Total: ' + testResults.total + ' Time: ' + time + 'ms');

      // Generate test report.
      if (config.outputReportPath) {
        var hbars = require('./handlebars.js');
        var source = fs.read(phantom.libraryPath + '/reportTemplate.html');
        var template = hbars.compile(source);
        var content = template(testResults);
        fs.write(config.outputReportPath, content, 'w');
      }

      // Turn off testing mode.
      var launchpadPage = webpage.create();
      launchpadPage.open("http://" + instanceName + "/sitecore/client/Applications/Launchpad?sc_testrunnerjs=0", function () {
        phantom.exit(testResults.fail);
      });
    }
  }

  function waitForTestEnd(runner, testPage, callback) {
    try {
      if (runner.testsComplete) {
        testResults.total += runner.testResults.total;
        testResults.pass += runner.testResults.pass;
        testResults.fail += runner.testResults.fail;
        testResults.details.push({ page: testPage, data: runner.testResults.details });

        callback();
      } else {
        setTimeout(function () { waitForTestEnd(runner, testPage, callback); }, 50);
      }
    } catch (e) {
      return phantom.exit(e.code || 1);
    }
  }
}).call(this);
