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

/**
 * Determines the hash to use for a destination path. This
 * is used to ensure the output files aren't affected by
 * browser caching in production mode.
 *
 * Typically, a hash is provided via process.env when running
 * jsdoc (i.e., when using a Fork job from @isomx/ui), so this
 * attempts to resolve it from there. If not,
 * it falls back to determining the value to use based on
 * the config file.
 * @param {Object} obj - The jsdoc config file
 * @param {string} envVar - The name of the var in process.env
 * to attempt to use.
 * @returns {?string}
 * The hash, which will also be set in the config file.
 * @ignore
 */
const resolveDestHash = (obj, envVar) => {
    let hash = process.env[envVar];
    if (typeof hash === 'string') {
        obj.destinationHash = hash && hash !== 'null' ? hash : null;
        return obj.destinationHash;
    }
    if (!(hash = obj.destinationHash)) {
        obj.destinationHash = null;
        return null;
    }
    if (hash !== true) {
        obj.destinationHash = hash;
        return hash;
    }
    try {
        const pkg = require(path.join(process.cwd(), 'package.json'));
        hash = pkg.version.replace(/\./g, '_');
    } catch(e) {
        throw new Error(`A destinationHash was provided, but it is \`true\`, indicating the package's version should be used. But no package.json was found in the current working directory.`);
    }
    obj.destinationHash = hash;
    return hash;
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
    /*
     *
     */
    const hash = resolveDestHash(opts, 'DOCS_DESTINATION_HASH');
    const dataOutput = opts.dataOutput;
    if (dataOutput && dataOutput.destination) {
        let { destination } = dataOutput;
        const hash = resolveDestHash(dataOutput, 'DOCS_DATA_DESTINATION_HASH');
        if (hash) {
            destination = path.join(destination, hash);
        }
        if (!path.isAbsolute(destination)) {
            destination = path.join(process.cwd(), destination);
        }
        dataOutput.destination = destination;
        if (dataOutput.privateSrcFilesMap) {
            privateSrcFilesMap = require(
              path.join(destination, 'privateSrcFilesMap.json')
            );
        }
    }
    if (!privateSrcFilesMap) {
        privateSrcFilesMap = {};
    }
    let { linksBasePath } = opts;
    if (hash) {
        linksBasePath = path.join(linksBasePath || '/', hash);
    }
    if (linksBasePath) {
        linksBasePath = linksBasePath.replace(/\\/g, '/');
        if (linksBasePath.charAt(0) !== '/') {
            linksBasePath = `/${linksBasePath}`;
        }
        if (linksBasePath.charAt(linksBasePath.length - 1) !== '/') {
            linksBasePath = `${linksBasePath}/`;
        }
    } else {
        linksBasePath = null;
    }
    linkFormatter = new LinkFormatter(linksBasePath);
    opts.privateSrcFilesMap = privateSrcFilesMap;
    opts.linksBasePath = linksBasePath;
    opts.linkFormatter = linkFormatter;
    docletHelper = new DocletHelper(linkFormatter);
    template = new Template(conf, opts);
    job = new PublishJob(template, opts);

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
    /*
     * See if we're being run via a fork job.
     * If so, call complete, the script
     * won't exit automatically.
     */
    if (global.devApi) {
        setTimeout(() => {
            global.devApi.scriptComplete(0);
        }, 5);
    }
};
