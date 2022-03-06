const search = /[{][\s\S|(]*(typeof\s+[^\s|)}]+)\s*[|)}\s\S]*[|)}]/g;
// converts @type {typeof module:someClass}
exports.handlers = {
  jsdocCommentFound: (e) => {
    if (!e.comment) return;
    // there can be multiple, so must search the string until not found anymore.
    let found = true, i, resp;
    while(found) {
      found = false;
      e.comment = e.comment.replace(search, (exp, section) => {
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
  }
};
