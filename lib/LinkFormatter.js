
/*
 * Ensures that if config.linksBasePath is
 * set, that all links in the output html
 * will use that base path. Useful
 * for embedding the docs and for hashing
 */
module.exports = class LinkFormatter {
    constructor(basePath) {
        this.basePath = basePath;
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
}
