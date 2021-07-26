////////////////////////////////////////////////////////////////////////
// CSS/Layout
// - static/css/baseline.css
// - style/bootstrap/baseline.less (end of file)
//
// I can't get the gulp CSS build process to work, thus the reason
// for manually adding the fix to the static css output. But
// if the building of CSS occurs, the update to baseline.less
// should add it back fine
///////////////////////////////////////////////////////////////////////
/*
1. Mermaid charts:

g{text-transform: none !important}


2. Nav & content layout to make it a fixed nav position and centered content:

#jsdoc-toc-nav{height:calc(100vh - 50px); overflow: auto; width:20% !important; right: 80% !important; position: fixed !important; margin-top: 0px !important; padding-top: 15px !important; top: 50px !important; padding-bottom: 3em;}

#jsdoc-content-container{width: 80% !important; left: 20% !important;}
#jsdoc-main{margin-left: auto; margin-right: auto; max-width: 1000px;}
ul.jqtree_common{ padding-bottom: 1em;}

See views/layouts/toc.hbs, part marked with ({{!-- appify changes --}}.
It is an added script that restores the scroll position of the nav sidebar.
*/



////////////////////////////////////////////////////////////////////////
// Inherited class properties fix - it was showing "unknown'.
//
// - lib/helpers/expression/index.js -> _handleParsedTypeMod()
//
// Notes added to that method, including details on the modified
// template files
///////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////
// Fixed Jquery nav tree having issue when local storage is undefined:
//
// - static_changes/tree.jquery.js
///////////////////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////////////////////
// "Home" page now uses a tutorial instead of the useless list of
// ALL members.
//
// - lib/publishJob -> generateIndex()
//
// Notes added to that method, including details on the other
// modified files.
/////////////////////////////////////////////////////////////////////////
