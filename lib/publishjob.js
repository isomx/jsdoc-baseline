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
/** @module lib/publishjob */

const _ = require('lodash');
const Filter = require('jsdoc/src/filter').Filter;
const fs = require('jsdoc/fs');
const helper = require('jsdoc/util/templateHelper');
const logger = require('jsdoc/util/logger');
const name = require('jsdoc/name');
const path = require('jsdoc/path');
const Scanner = require('jsdoc/src/scanner').Scanner;
const hljs = require('./highlight');

let finders;

// loaded by the file finder
let ENUMS;
let CATEGORIES;
let OUTPUT_FILE_CATEGORIES;

// set up modules that cannot be preloaded
function init() {
    if (!ENUMS) {
        finders = {
            // this finder should exist by the time we get here
            modules: require('./filefinder').get('modules')
        };
        ENUMS = finders.modules.require('./enums');
        CATEGORIES = ENUMS.CATEGORIES;
        OUTPUT_FILE_CATEGORIES = ENUMS.OUTPUT_FILE_CATEGORIES;
    }
}

function __writeFile(path, data, encoding) {
    try {
        fs.writeFileSync(path, data, encoding);
    } catch (e) {
        logger.error(`Unable to save the output file %s: %s`, path, e.message);
    }
}

/**
 * Get a tutorial's children recursively.
 *
 * @private
 * @param {module:jsdoc/tutorial.Tutorial} tutorial - The tutorial to use.
 * @return {Array<module:jsdoc/tutorial.Tutorial>} The child tutorials.
 */
function getTutorialChildren(tutorial) {
    let children = tutorial.children;

    tutorial.children.forEach(child => {
        children = children.concat(getTutorialChildren(child));
    });

    return children;
}

module.exports = class PublishJob {
    constructor(template, options) {
        this.linkFormatter = options.linkFormatter;
        this.privateSrcFilesMap = options.privateSrcFilesMap;
        /*
         * Contains the urls that are known to be correct,
         * meaning the file has been generated for it. There
         * are links to files that aren't ever generated,
         * so this makes it possible to filter out those
         * later before saving raw output.
         *
         * For example, inline doc tags that aren't
         * published would get a URL, but they won't
         * be published or used, so it can be removed.
         */
        this.validUrls = {};
        // directories created by the `publish` job
        this.outputDirectories = {};
        this.templateConfig = template.config;

        this.options = options;
        this.destination = options.destination;
        this.navTree = null;
        this.package = null;
        this.pageTitlePrefix = '';
        this.template = template.init();
        this.renderOptions = {
            beautify: this.templateConfig.beautify
        };

        init();

        // claim some special filenames in advance
        // TODO: we used to avoid calling `registerLink` on `index`; okay that we do it now?
        // if not, should we stop registering `global`, too?
        this.indexUrl = this.linkFormatter.addBase(helper.getUniqueFilename('index'));
        helper.registerLink('index', this.indexUrl);
        this.globalUrl = this.linkFormatter.addBase(helper.getUniqueFilename('global'));
        helper.registerLink('global', this.globalUrl);
    }

    setPackage(packageDoclet) {
        this.package = packageDoclet;

        if (this.package && this.package.name) {
            this.pageTitlePrefix = this.template.translate('pageTitlePrefix', {
                name: this.package.name,
                version: this.package.version || ''
            });
        }

        return this;
    }

    setNavTree(navTree) {
        this.navTree = navTree;

        return this;
    }

    setAllLongnamesTree(allLongnamesTree) {
        this.allLongnamesTree = allLongnamesTree;

        return this;
    }

    copyStaticFiles() {
        let userStaticFilter;
        let userStaticPaths;
        let userStaticScanner;

        const destination = this.destination;
        const RECURSE_DEPTH = 10;
        const self = this;
        // start with the master template's path, then use any child templates' paths
        const templateStaticPaths = this.templateConfig.static.slice(0).reverse();

        function copyStaticFile(filepath, staticPath) {
            let relativePath = staticPath ?
                path.normalize(filepath.replace(staticPath, '')) :
                filepath;
            let toDir;

            if (relativePath.indexOf(path.sep) === 0) {
                relativePath = relativePath.substr(1);
            }
            toDir = fs.toDir(path.resolve(destination, relativePath));

            self.createOutputDirectory(path.resolve(destination, toDir));
            logger.debug('Copying static file %s to %s',
                path.relative(self.template.path, filepath),
                toDir);
            fs.copyFileSync(filepath, toDir);
        }

        // copy the template's static files
        templateStaticPaths.forEach(staticPath => {
            fs.ls(staticPath, RECURSE_DEPTH).forEach(filepath => {
                copyStaticFile(filepath, staticPath);
            });
        });


        // copy user-specified static files
        if (this.templateConfig.staticFiles) {
            userStaticPaths = this.templateConfig.staticFiles.paths || [];
            userStaticFilter = new Filter(this.templateConfig.staticFiles);
            userStaticScanner = new Scanner();

            userStaticPaths.forEach(filepath => {
                const extraFiles = userStaticScanner.scan([filepath], RECURSE_DEPTH,
                    userStaticFilter);

                extraFiles.forEach(copyStaticFile);
            });
        }

        return this;
    }

    createOutputDirectory(relativePath) {
        const newPath = relativePath ?
            path.resolve(this.destination, relativePath) :
            this.destination;

        /* istanbul ignore else */
        if (!this.outputDirectories[newPath]) {
            logger.debug('Creating the output directory %s', newPath);
            fs.mkPath(newPath);
            this.outputDirectories[newPath] = true;
        }

        return this;
    }

    render(viewName, data, options) {
        const opts = _.defaults(options, this.renderOptions);

        return this.template.render(viewName, data, opts);
    }

    // `data` is whatever the template expects.
    generate(viewName, data, url) {
        const encoding = this.template.encoding;
        const options = {};
        let output;
        url = this.linkFormatter.removeBase(url);
        const outputPath = path.join(this.destination, url);

        data.package = data.package || this.package;

        // Don't try to beautify non-HTML files.
        if (path.extname(url) !== '.html') {
            options.beautify = false;
        }

        logger.debug('Rendering template output for %s with view %s', url, viewName);
        output = this.render(viewName, data, options);
        /*
         * My addition to handle custom processing of a
         * symbol's output.
         */
        if (viewName === 'symbol') {
            const {docs} = data;
            const doc = docs[0];
            if (docs.length === 1 && doc.logic && doc.kind === 'module') {
                /*
                 * Replace "Methods" and "Properties" callout headings with
                 * "Functional Logic" and "Standard Logic", respectively.
                 *
                 * I traced this through the template, but overriding
                 * the handlebars partial to do this is way too involved.
                 * So I'm just doing it here. This used to be done with
                 * a script once the page loaded. But now that the docs
                 * are embedded with just the body content, I'm doing it
                 * this way.
                 */
                const {functions, properties} = data.members;
                if (functions.length === 1) {
                    output = output.replace(
                        '<h2 class="summary-callout-heading">Method</h2>',
                        '<h2 class="summary-callout-heading">Functional Logic</h2>'
                    ).replace(
                        '<h2>Method</h2>',
                        '<h2>Functional Logic</h2>'
                    )
                } else if (functions.length > 1) {
                    output = output.replace(
                        '<h2 class="summary-callout-heading">Methods</h2>',
                        '<h2 class="summary-callout-heading">Functional Logic</h2>'
                    ).replace(
                        '<h2>Methods</h2>',
                        '<h2>Functional Logic</h2>'
                    )
                }
                if (properties.length === 1) {
                    output.replace(
                        '<h2 class="summary-callout-heading">Property</h2>',
                        '<h2 class="summary-callout-heading">Standard Logic</h2>'
                    ).replace(
                        '<h2>Property</h2>',
                        '<h2>Standard Logic</h2>'
                    );
                } else if (properties.length > 1) {
                    output.replace(
                        '<h2 class="summary-callout-heading">Properties</h2>',
                        '<h2 class="summary-callout-heading">Standard Logic</h2>'
                    ).replace(
                        '<h2>Properties</h2>',
                        '<h2>Standard Logic</h2>'
                    );
                }
            }
            /*
             * Remove all the printing of "module:" prefixes,
             * this doesn't affect links.
             */
            output = output.replace(/module:/g, '');
            /*
             * The Model meta fields are named _ts_, _tsAction_,
             * etc., which is interpreted by the markdown processing
             * as italic. Reverse that.
             */
            output = output
                .replace(/<em>ts<\/em>/g, '_ts_')
                .replace(/<em>tsAction<\/em>/g, '_tsAction_')
                .replace(/<em>tsSessionId<\/em>/g, '_tsSessionId_');
        }
        try {
            this.createOutputDirectory(path.dirname(url));
            fs.writeFileSync(outputPath, output, encoding);
            this.validUrls[this.linkFormatter.addBase(url)] = true;
        } catch (e) {
            logger.error('Unable to save the output file %s: %s', outputPath, e.message);
        }

        return this;
    }

    generateTocData(options) {
        const navTree = this.navTree;
        const targets = [];
        const tocData = [];

        options = options || {};

        /*
         * My addition to prevent adding links to
         * a file that doesn't exist. If it's not
         * in the "needsFile" Object, it won't exist.
         */
        const needsFile = options.needsFile || {};

        class TocItem {
            constructor(item, children) {
                this.label = helper.linkto(item.longname, name.stripNamespace(item.name));
                this.id = item.longname;
                this.children = children || [];
            }
        }

        function addItems(data) {
            Object.keys(data).sort().forEach(key => {
                const item = data[key];
                let tocEntry;

                if (item) {
                    tocEntry = new TocItem(item);

                    if (!targets.length) {
                        tocData.push(tocEntry);
                    } else {
                        targets[targets.length - 1].children.push(tocEntry);
                    }

                    targets.push(tocEntry);
                    if (item.children) {
                        addItems(item.children);
                    }
                    targets.pop();
                }
            });
        }

        // If there are globals, force their TOC item to come first
        if (options.hasGlobals) {
            addItems({
                'global': {
                    name: 'Globals',
                    longname: 'global',
                    children: []
                }
            });
        }
        addItems(navTree);
        const tocDataJson = [];

        /*
         * My addition to create navData that
         * is used by isomx when embedding the
         * docs.
         */
        class TocJsonItem {
            constructor(item, parentChildren) {
                if (parentChildren) {
                    parentChildren.push(this);
                } else {
                    tocDataJson.push(this);
                }
                var itemChildren = item.children;
                var children = [];
                var matches = [];
                /*
                 * See https://stackoverflow.com/a/369174/6757119
                 * Contains an explanation.
                 */
                item.label.replace(
                    /[^<]*(<a href="([^"]+)">([^<]+)<\/a>)/g,
                    function () {
                        matches.push(Array.prototype.slice.call(arguments, 1, 4));
                    }
                );
                this.id = item.id;
                this.children = children;
                /*
                 * Not worth it to include `pageTitle`. A better title can
                 * be determined by just parsing the longname.
                 */
                // this.pageTitle = name.stripNamespace(name.shorten(item.id).name);
                let result = matches[0];
                if (result) {
                    this.link = item.label;
                    this.url = result[1];
                    this.label = result[2];
                    /*
                     * Make sure it's a valid link. This
                     * is my addition, and it may only be
                     * relevant for my current uses, but
                     * without this check a link can be
                     * added to a file that does not exist.
                     * This causes an error when attempting
                     * to access the file, so prevent it
                     * from being a link in the first place.
                     *
                     * Note that relying on helper.longnameToUrl
                     * isn't sufficient - it'll still allow
                     * bad links through.
                     */
                    const hasHash = this.url.indexOf('.html#') > 0;
                    if (hasHash) {
                        const parts = this.url.split('#');
                        this.urlBase = parts[0];
                        this.urlHash = parts[1];
                    } else if (
                        false
                        && !needsFile[item.id]
                        && item.id.startsWith('module:')
                    ) {
                        this.link = null;
                        this.url = null;
                        item.label = this.label;
                    } else {
                        this.urlBase = this.url;
                        this.urlHash = null;
                    }
                } else {
                    this.label = item.label;
                    this.link = null;
                    this.url = null;
                    this.urlBase = null;
                    this.urlHash = null;
                }
                for (let child of itemChildren) {
                    new TocJsonItem(child, children)
                }
            }
        }

        for (let item of tocData) {
            new TocJsonItem(item);
        }
        this.navTreeJsonData = tocDataJson;
        return this.generate('toc', {tocData}, 'scripts/jsdoc-toc.js');
    }

    generateTutorials(tutorials) {
        getTutorialChildren(tutorials).forEach(function(child) {
            const title = name.stripNamespace(child.title);
            const tutorialData = {
                pageCategory: CATEGORIES.TUTORIALS,
                pageTitle: title,
                pageTitlePrefix: this.pageTitlePrefix,
                header: title,
                tutorialContent: child.content,
                tutorialChildren: child.children
            };
            const url = helper.tutorialToUrl(child.name);

            this.generate('tutorial', tutorialData, url);
        }, this);

        return this;
    }

    generateSourceFiles(pathMap) {
        const encoding = this.options.encoding;
        const self = this;
        let url;

        if (this.templateConfig.sourceFiles.generate !== false) {
            const linkFormatter = this.linkFormatter;
            const privateSrcFilesMap = this.privateSrcFilesMap;
            Object.keys(pathMap).forEach(function(file) {
                if (privateSrcFilesMap[file]) {
                    // marked as private, do not render
                    return;
                }
                const data = {
                    docs: null,
                    pageCategory: CATEGORIES.SOURCES,
                    pageTitle: pathMap[file],
                    pageTitlePrefix: this.pageTitlePrefix
                };

                // links are keyed to the shortened path
                url = linkFormatter.addBase(helper.getUniqueFilename(pathMap[file]));
                helper.registerLink(pathMap[file], url);

                try {
                    data.docs = helper.htmlsafe(fs.readFileSync(file, encoding));
                }
                catch (e) {
                    logger.error('Unable to generate output for source file %s: %s', file, e.message);

                    return;
                }
                let docs = data.docs.replace(/&amp;/g, '&');
                docs = hljs.highlight(docs, {language: 'js'}).value;
                let numbered = docs.split('\n');
                const totalSpaces = numbered.length.toString().length + 3;
                let counter = 0;
                data.docs = numbered.map(item => {
                    // item = item
                    //     .replace(/&/g, "&amp;")
                    //     .replace(/</g, "&lt;")
                    //     .replace(/>/g, "&gt;")
                    //     .replace(/"/g, "&quot;")
                    //     .replace(/'/g, "&#039;");
                    counter++;
                    let content = `${counter}.`;
                    const spaces = totalSpaces - counter.toString().length;
                    let i = 0;
                    while (i < spaces) {
                        content += `&nbsp;`;
                        i++;
                    }
                    return `<span id="source-line-${counter}" class="line">${content}</span>${item}`;
                }).join('\n');
                self.generate('source', data, url);
            }, this);
        } else {
            logger.debug('Pretty-printed source files are disabled; not generating them');
        }

        return this;
    }

    generateGlobals(globalSymbols) {
        let data;
        const title = this.template.translate(`headings.${CATEGORIES.GLOBALS}`,
            globalSymbols.get().length);

        if (globalSymbols && globalSymbols.hasDoclets()) {
            data = {
                members: globalSymbols.get(null, { categorize: true }),
                pageCategory: null,
                pageHeading: title,
                pageTitle: this.template.translate('pageTitleNoCategory', {
                    prefix: this.pageTitlePrefix,
                    title
                }),
                pageTitlePrefix: this.pageTitlePrefix
            };
            this.generate('globals', data, this.globalUrl);
        } else {
            logger.debug('Not generating a globals page because no globals were found');
        }

        return this;
    }

    // TODO: index contents need to change
    /*
     * This is my modification to display a tutorial's
     * content as the "Home" page rather than the useless
     * list of properties.
     *
     * I added the tutorials param by modifying the
     * ../publish.js, line 71 that calls this method
     *
     * Furthermore, you have to modify the .hbs file:
     * ../views/partials/symbol-index.hbs
     */
    generateIndex(readme, tutorials) {
        if (tutorials && tutorials.children) {
            if (!readme) readme = 'home';
            const { children } = tutorials;
            let home;
            for(let child of children) {
                if (child.name === readme) {
                    home = child;
                    break;
                }
            }
            if (home) {
                this.generate(
                    'index',
                    // rename content to "tutorialContent"
                    // or it clashes with a defined partial
                    { ...home, tutorialContent: home.content },
                    this.indexUrl
                );
                return this;
            }
        }
        // End my additions
        const data = {
            allLongnamesTree: this.allLongnamesTree,
            package: this.package,
            pageTitle: this.template.translate('pageTitleNoCategory', {
                prefix: this.pageTitlePrefix,
                title: this.template.translate('brandDefault')
            }),
            readme: readme || null
        };

        this.generate('index', data, this.indexUrl);

        return this;
    }

    generateByLongname(longname, doclets = {}, members) {
        Object.keys(doclets).forEach(function(category) {
            let data;
            let url;

            // Don't generate output if:
            // + There are no doclets
            // + The current category is not one that gets its own output page
            // + We have a module with the same longname, and the current category isn't modules
            if (
                !doclets[category].length
                || !OUTPUT_FILE_CATEGORIES.includes(category)
                || (
                    category !== CATEGORIES.MODULES
                    && doclets[CATEGORIES.MODULES].length
                )
            ) {
                return;
            }

            url = helper.longnameToUrl[longname];
            data = {
                docs: doclets[category],
                members: members || {},
                pageCategory: category,
                pageTitle: name.stripNamespace(name.shorten(longname).name),
                pageTitlePrefix: this.pageTitlePrefix
            };

            this.generate('symbol', data, url);
        }, this);

        return this;
    }

    generateRawDataOutput(docletHelper) {
        const outConfig = this.options.dataOutput;
        const outDir = outConfig && outConfig.destination;
        if (!outDir) {
            return this;
        }
        const encoding = this.template.encoding;
        try {
            fs.mkPath(outDir);
        } catch (e) {
            logger.error(`Unable to create the output directory for the raw data %s: %s`, outDir, e.message);
            return this;
        }
        let _hashIdx;
        const stripHash = (str) => {
            _hashIdx = str.indexOf('#');
            if (_hashIdx >= 0) {
                return str.substring(0, _hashIdx);
            } else {
                return str;
            }
        }
        const toString = (data) => JSON.stringify(data, undefined, 4);
        const {validUrls} = this;
        const _all = docletHelper.all;
        const _longnameToUrl = helper.longnameToUrl;
        const all = {}, longnameToUrl = {}, longnameToSrcUrl = {};
        /*
         * Filter out doclets that aren't included in published
         * docs. For example, ones for inline properties like
         * properties in a function that are documented with
         * @type {}, but only to get the type recognition.
         *
         * I'm also compiling a `excludedWithHash` and `excludedWithoutHash`
         * that can be output to help identify doclets that
         * were excluded from the output. The `excludedWithHash`
         * is especially useful, since typically ones
         * in this Array were excluded due to some error
         * in how the documentation was added and they
         * should be fixed.
         *
         * The inline tags as described above will almost
         * always have `~` as the identifier, thus
         * why the `excludedWithHash` is usually the
         * more relevant.
         */
        const excludedWithHash = {};
        const excludedWithoutHash = {};
        let meta, lineno, shortpath, doclet, shortUrl;
        for (let key in _all) {
            doclet = _all[key];
            doclet.url = _longnameToUrl[key];
            if (!validUrls[stripHash(_longnameToUrl[key])]) {
                if (key.indexOf('~') < 0) {
                    excludedWithHash[key] = doclet;
                } else {
                    excludedWithoutHash[key] = doclet;
                }
                continue;
            }
            all[key] = doclet;
            longnameToUrl[key] = _longnameToUrl[key];
            if (
                (meta = doclet.meta)
                && typeof (lineno = meta.lineno) === 'number'
                && (shortpath = meta.shortpath)
                && (shortUrl = _longnameToUrl[shortpath])
                // only include if it was output
                // (i.e., not blocked due to privateSrcFilesMap)
                && validUrls[shortUrl]
            ) {
                if (lineno > 1) {
                    longnameToSrcUrl[key] = `${shortUrl}#source-line-${lineno}`;
                } else {
                    longnameToSrcUrl[key] = shortUrl;
                }
                doclet.srcUrl = longnameToSrcUrl[key];
            } else {
                doclet.srcUrl = null;
                longnameToSrcUrl[key] = null;
            }
        }
        const navTree = this.navTreeJsonData;
        const flatTree = {};
        const urlBaseToItemId = {};
        const descend = (item, parent) => {
            if (item.urlBase && !validUrls[item.urlBase]) {
                item.url = null;
                item.urlBase = null;
                item.urlHash = null;
            }
            const {children, url, urlBase, urlHash} = item;
            const newChildren = [];
            const newItem = {
                itemId: item.id,
                label: item.label,
                parentId: parent ? parent.itemId : null,
                urlBase,
                urlHash,
                url,
                childIds: newChildren,
                depth: parent ? parent.depth + 1 : 1,
            };
            if (urlBase) {
                urlBaseToItemId[urlBase] = newItem.itemId;
            }
            flatTree[newItem.itemId] = newItem;
            if (children.length) {
                newItem.hasChildren = true;
                for (let child of children) {
                    descend(child, newItem);
                }
                newChildren.sort();
            } else {
                newItem.hasChildren = false;
            }
            if (parent) {
                parent.childIds.push(newItem.itemId);
            }
            return newItem;
        }
        for (let item of navTree) {
            descend(item);
        }

        if (outConfig.navTree) {
            __writeFile(
                path.join(outDir, 'navTree.json'),
                toString(navTree),
                encoding
            );
        }
        if (outConfig.navData) {
            __writeFile(
                path.join(outDir, 'navData.json'),
                toString(flatTree),
                encoding
            );
        }
        if (outConfig.navUrlBaseToItemId) {
            __writeFile(
                path.join(outDir, 'navUrlBaseToItemId.json'),
                toString(urlBaseToItemId),
                encoding
            );
        }
        if (outConfig.docletsTree) {
            __writeFile(
                path.join(outDir, 'docletsTree.json'),
                toString(docletHelper.allLongnamesTree),
                encoding
            );
        }
        if (outConfig.doclets) {
            __writeFile(
                path.join(outDir, 'doclets.json'),
                toString(all),
                encoding
            );
        }
        if (outConfig.longnameToUrl) {
            __writeFile(
                path.join(outDir, 'longnameToUrl.json'),
                toString(longnameToUrl),
                encoding
            );
        }
        if (outConfig.longnameToSrcUrl) {
            __writeFile(
                path.join(outDir, 'longnameToSrcUrl.json'),
                toString(longnameToSrcUrl),
                encoding
            );
        }
        if (outConfig.excludedDocletsWithHash) {
            __writeFile(
                path.join(outDir, 'excludedDocletsWithHash.json'),
                toString(excludedWithHash),
                encoding
            );
        }
        if (outConfig.excludedDocletsWithoutHash) {
            __writeFile(
                path.join(outDir, 'excludedDocletsWithoutHash.json'),
                toString(excludedWithoutHash),
                encoding
            );
        }
        if (outConfig.graphqlLongnameToUrl) {
            const p = path.join(outDir, '/graphqlLongnameToUrl.json');
            let obj;
            try {
                obj = require(p);
            } catch (e) {
                console.log(`Error attempting to require ${p}:\n${e.stack}`);
                return this;
            }
            for(let longname in obj) {
                obj[longname] = longnameToUrl[longname];
            }
            __writeFile(
                path.join(outDir, 'graphqlLongnameToUrl.json'),
                toString(obj),
                encoding
            );
        }
        if (outConfig.pluginsUrlMap) {
            const p = path.join(outDir, '/pluginsLongnameMap.json');
            let byLongname;
            try {
                byLongname = require(p);
            } catch(e) {
                console.log(`Error attempting to require ${p} in order to build out pluginsUrlMap.json: ${e.stack}`)
            }
            const convert = (src) => {
                if (!src) return null;
                const obj = {};
                for(let key in src) {
                    obj[key] = longnameToUrl[src[key]];
                }
                return obj;
            }
            const resp = {};
            let obj;
            for(let key in byLongname) {
                obj = byLongname[key];
                resp[key] = {
                    plugin: longnameToUrl[obj.plugin],
                    store: longnameToUrl[obj.store],
                    models: convert(obj.models),
                    modelStores: convert(obj.modelStores),
                    records: convert(obj.records),
                    recordStores: convert(obj.recordStores)
                }
            }
            __writeFile(
                path.join(outDir, 'pluginsUrlMap.json'),
                toString(resp),
                encoding
            );
        }
        return this;
    }
};
