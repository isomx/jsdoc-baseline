/*
added style override so that mermaid charts
are not coerced into uppercase.
See: static/css/baseline.css - g{text-transform: none !important}
See: style/bootstrap/baseline.less, end of file: g{text-transform: none !important}
I can't get the gulp CSS build process to work, thus the reason
for manually adding the fix to the static css output. But
if the building of CSS occurs, the update to baseline.less should add it back fine


Fixed inherited class properties showing type "unknown"
see: lib/helpers/expression/index.js -> _handleParsedTypeMod()
Notes on that method, including details on the modified template file
 */