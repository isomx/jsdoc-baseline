// The ending [\}\s] is to catch incorrectly formatted links like:
// [something]{@link module:somewhere/here] <- wrong closing
// It'll also catch patterns that don't close the link - anything
// up to a space or new line.
const linkRegexp = /@link\s+((?!http:)(?!https:)(?:.|)+?)[\}\s]/gi;
// const linkElemRegexp = /<a\s.*?href=['"](?!http:)(?!https:).+?['"].*?>.*<\/a>/gi;
/*
 * This RegExp will extract the link portion from a @link tag
 */
// const linkUrlRegexp = /\{@link\s+((?:.|)+?)\}/i;

/*
 * Ensures that if config.linksBasePath is
 * set, that all links in the output html
 * will use that base path. Useful
 * for embedding the docs and for hashing
 */
module.exports = class LinkFormatter {
    constructor(basePath, opts) {
        this.basePath = basePath;
        const dataOutput = opts.dataOutput;
        if (dataOutput) {
            this.brokenLinks = dataOutput.brokenLinks
                ? new Set()
                : null;
            this.brokenLinksIgnoreList = dataOutput.brokenLinksIgnoreList;
            this.brokenNavLinks = dataOutput.brokenNavLinks
                ? new Set()
                : null;
            this.brokenNavLinksIgnoreList = dataOutput.brokenNavLinksIgnoreList;
        } else {
            this.brokenLinks = null;
            this.brokenLinksIgnoreList = null;
            this.brokenNavLinks = null;
            this.brokenNavLinksIgnoreList = null;
        }
    }

    // It's not available when we get initialized, so it
    // is provided by publishJob.js
    setLongnameToUrl(longnameToUrl) {
        this.longnameToUrl = longnameToUrl;
        return this;
    }

    addBase(url) {
        if (!this.basePath || url.startsWith(this.basePath)) {
            return url;
        } else {
            return `${this.basePath}${url}`;
        }
    }

    removeBase(url) {
        if (!url || !this.basePath || !url.startsWith(this.basePath)) {
            return url;
        } else {
            return url.replace(this.basePath, '');
        }
    }

    addToBrokenLinks(longname) {
        if (
            this.brokenLinks
            // See notes on these in checkForBrokenLinks()
            && longname !== 'module:graphql.GraphQLEnumType'
            && longname !== 'module:graphql.GraphQLInputObjectType'
            && longname !== 'module:graphql.GraphQLObjectType'
        ) {
            this.brokenLinks.add(longname);
        }
    }

    checkForBrokenLinks(str) {
        if (!str || !this.brokenLinks || !this.longnameToUrl) return;
        const brokenLinks = this.brokenLinks;
        const longnameToUrl = this.longnameToUrl;
        let m;
        while((m = linkRegexp.exec(str)) !== null) {
            if (!longnameToUrl[m[1]]) {
                /*
                 * The jsdoc plugin that provides the ability
                 * to do `@type {import("..')}` sees that
                 * `graphql` is a known module for Core, so
                 * `import("graphql").GraphQLEnumType` gets
                 * replaced with `module:graphql`, thinking
                 * it's importing a module's reference
                 * rather than a package.
                 */
                if (
                    m[1] !== 'module:graphql.GraphQLEnumType'
                    && m[1] !== 'module:graphql.GraphQLInputObjectType'
                    && m[1] !== 'module:graphql.GraphQLObjectType'
                ) {
                    brokenLinks.add(m[1]);
                }

            }
        }
        linkRegexp.lastIndex = 0;
    }

    checkForBrokenNavLink(longname) {
        if (!longname || !this.brokenNavLinks || !this.longnameToUrl) return;
        if (!this.longnameToUrl[longname]) {
            this.brokenNavLinks.add(longname);
        }
    }

    stripMember(longname) {
        let idx = longname.indexOf('#');
        if (
            idx > -1
            || (idx = longname.indexOf('.')) > -1
            || (idx = longname.indexOf('~')) > -1
        ) {
            return longname.substring(0, idx);
        }
        return longname;
    }

    _getBrokenLinksResult(setKey, ignoreKey) {
        const broken = this[setKey];
        if (!broken || !broken.size) return null;
        const ignore = this[ignoreKey];
        if (!ignore) {
            return [ ...broken ];
        }
        for(let longname of ignore) {
            broken.delete(longname);
        }
        if (ignoreKey !== 'brokenNavLinksIgnoreList') {
            let parent, curr;
            for(let longname of broken) {
                curr = longname;
                while((parent = this.stripMember(curr)) !== curr) {
                    if (ignore.indexOf(parent) > -1) {
                        broken.delete(longname);
                        break;
                    }
                    curr = parent;
                }
            }
        }
        return broken.size ? [ ...broken ] : null;
    }

    getBrokenLinksResult() {
        return this._getBrokenLinksResult('brokenLinks', 'brokenLinksIgnoreList');
    }

    getBrokenNavLinksResult() {
        return this._getBrokenLinksResult('brokenNavLinks', 'brokenNavLinksIgnoreList');
    }

    // extractLinkLongnames(str, forBrokenLinks) {
    //     if (!str || (forBrokenLinks && !this.brokenLinks)) {
    //         return null;
    //     }
    //     const brokenLinksIgnore = forBrokenLinks && this.brokenLinksIgnore;
    //     let matches;
    //     let m, longname;
    //     while((m = linkRegexp.exec(str)) !== null) {
    //         longname = m[1];
    //         if (
    //             (!brokenLinksIgnore || brokenLinksIgnore.indexOf(longname) < 0)
    //             && (matches || (matches = []))
    //         ) {
    //             matches.push(longname);
    //         }
    //     }
    //     linkRegexp.lastIndex = 0;
    //     return matches;
    // }
    //
    // extractLinkElements(str, forBrokenLinks) {
    //     if (!str || (forBrokenLinks && !this.brokenLinks)) {
    //         return null;
    //     }
    //     return str.match(linkElemRegexp);
    // }




}
