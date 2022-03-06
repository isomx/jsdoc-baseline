/*
 * Ensures that if config.linksBasePath is
 * set, that all links in the output html
 * will use that base path. Useful
 * for embedding the docs
 */
module.exports = class LinkFormatter {
    constructor(config) {
        let basePath = config.linksBasePath;
        if (basePath) {
            if (basePath.charAt(0) !== '/') {
                basePath = `/${basePath}`;
            }
            if (basePath.charAt(basePath.length - 1) !== '/') {
                basePath = `${basePath}/`;
            }
            this.basePath = basePath;
        } else {
            this.basePath = null;
        }
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
