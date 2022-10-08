
const search = /(typeof\s+[^\s|)}]+)/g;
const tag = /(@(?!example|link).+\s[^@`}]+}?)/g;
// converts @type {typeof module:someClass}
exports.handlers = {
  jsdocCommentFound: (e) => {
    const comment = e.comment;
    if (!comment) return;
    // there can be multiple, so must search the string until not found anymore.
    let result = comment, match, part, found, i, resp;
    while((match = tag.exec(comment))) {
        part = match[0];
        found = true;
        while(found) {
            found = false;
            part = part.replace(search, (exp, section) => {
                i = 7;
                resp = 'Class.<';
                while(i < section.length) {
                    resp += section[i];
                    i++;
                }
                resp += '>';
                found = true;
                return exp.replace(section, resp);
            })
        }
        result = result.replace(match[0], part);
    }
    tag.lastIndex = 0;
    e.comment = result;
  }
};



//////////////////////////////////////////////////
// Version from before 07/22/2022
// It matches typeof in code examples too,
// so the above solution was created.
/////////////////////////////////////////////////
// const search = /[{][\s\S|(]*(typeof\s+[^\s|)}]+)\s*[|)}\s\S]*[|)}]/g;
// // converts @type {typeof module:someClass}
// exports.handlers = {
//   jsdocCommentFound: (e) => {
//     if (!e.comment) return;
//     // there can be multiple, so must search the string until not found anymore.
//     let found = true, i, resp;
//     while(found) {
//       found = false;
//       e.comment = e.comment.replace(search, (exp, section) => {
//         i = 7;
//         resp = 'Class.<';
//         while(i < section.length) {
//           resp += section[i];
//           i++;
//         }
//         resp += '>';
//         found = true;
//         return exp.replace(section, resp);
//       })
//     }
//   }
// };
