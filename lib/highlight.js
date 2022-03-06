const highlight = require('highlight.js/lib/common');
const gql = require('highlightjs-graphql');
// add graphql highlighting
gql(highlight);

module.exports = highlight;
