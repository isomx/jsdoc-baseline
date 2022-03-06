const hljs = require('./highlight');

/*
 * Custom highlighter for markdown code
 * that will use highlight.js rather than
 * prettify.
 *
 * To use, modify jsdoc config file:
 *
 * ```json
 * {
 *   "markdown": {
 *      "highlight": "path-to-this-file"
 *    }
 * }
 * ```
 */
module.exports = {
    highlight: function(code, language) {
        const lang = {};
        let className;
        if (language) {
            lang.language = language;
            className = `hljs lang-${language}`;
        } else {
            lang.language = 'js';
            className = `hljs lang-js`;
        }
        return `<pre class="${className}"><code class="nohighlight">${hljs.highlight(code, lang).value}</code></pre>`;
    }
}
