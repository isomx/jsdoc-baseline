/*
    Copyright 2014-2019 Google LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
const config = require('./lib/config');
const path = require('path');
let DocletHelper;
let finders;
const helper = require('jsdoc/util/templateHelper');
let PublishJob;
let Template;
let LinkFormatter;

// Intl.PluralRules polyfill
require('intl-pluralrules');

function init(filepaths) {
    finders = {
        modules: require('./lib/filefinder').get('modules', filepaths)
    };

    DocletHelper = finders.modules.require('./doclethelper');
    PublishJob = finders.modules.require('./publishjob');
    Template = finders.modules.require('./template');
    LinkFormatter = finders.modules.require('./LinkFormatter');
}

exports.publish = (data, opts, tutorials) => {
    const conf = config.loadSync().get();
    let docletHelper;
    let job;
    let template;
    let linkFormatter;
    let privateSrcFilesMap;

    // load the core modules using the file finder
    init(conf.modules);


    linkFormatter = new LinkFormatter(conf);
    if (conf.privateSrcFilesMap) {
        privateSrcFilesMap = require(path.join(process.cwd(), conf.privateSrcFilesMap));
    } else {
        privateSrcFilesMap = {};
    }
    docletHelper = new DocletHelper(linkFormatter);
    template = new Template(conf, privateSrcFilesMap);
    job = new PublishJob(template, opts, linkFormatter, privateSrcFilesMap);

    // set up tutorials
    helper.setTutorials(tutorials);

    docletHelper.addDoclets(data);

    job.setPackage(docletHelper.getPackage())
        .setNavTree(docletHelper.navTree)
        .setAllLongnamesTree(docletHelper.allLongnamesTree);

    // create the output directory so we can start generating files
    job.createOutputDirectory()
        // then generate the source files so we can link to them
        .generateSourceFiles(docletHelper.shortPaths);

    // generate globals page if necessary
    job.generateGlobals(docletHelper.globals);

    // console.log('ALL = ', docletHelper.all);
    // generate TOC data and index page
    job.generateTocData({
        hasGlobals: docletHelper.hasGlobals(),
        needsFile: docletHelper.needsFile,
        all: docletHelper.all,
        allLongnamesTree: docletHelper.allLongnamesTree
    })
      /*
       * ^^ I added needsFile to `options` to prevent adding
       * nav links to a file that doesn't exist.
       *
       * And this is my addition to pass the "tutorials" to
       * the index method so that it can render a tutorial instead.
       */
      .generateIndex(opts.readme, tutorials);

    // generate the rest of the output files (excluding tutorials)
    docletHelper.getOutputLongnames().forEach(longname => {
        job.generateByLongname(longname, docletHelper.getLongname(longname),
            docletHelper.getMemberof(longname));
    });

    // finally, generate the tutorials, and copy static files to the output directory
    job.generateTutorials(tutorials)
        .copyStaticFiles();

    job.generateRawDataOutput(docletHelper);
};
