/*
 * Used to change the callout heading from "Methods"
 * and "Properties" to "Functional Logic" and "Standard Logic"
 */
module.exports.defineTags = function(dictionary) {
    dictionary.defineTag("logic", {
        mustHaveValue: false,
        canHaveType: false,
        canHaveName: false,
        onTagged: function (doclet, tag) {
            doclet.logic = tag.text || true;
        }
    })
}
