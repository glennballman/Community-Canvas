const fs = require('fs');

let content = fs.readFileSync('shared/chamber-members.ts', 'utf8');

// Pattern: After an inner object closes with },  followed by comments then {
// We need to insert }, before the comments

// Fix: Find pattern where:
//   1. Line ends with inner close (4-space },  or })
//   2. Followed by optional empty lines and/or comments
//   3. Followed by array element start (2-space {)
// Insert 2-space }, after inner close

// This regex finds:
// (    }, or })\n(empty lines or // comments)\n(  {)
// And inserts   }, after the first group

const pattern = /(    },?\n)((?:\s*(?:\/\/[^\n]*)?\n)*)(  \{)/g;

content = content.replace(pattern, (match, innerClose, commentsOrEmpty, arrayStart) => {
  return innerClose + '  },\n' + commentsOrEmpty + arrayStart;
});

fs.writeFileSync('shared/chamber-members.ts', content);
console.log('Final fix applied');
