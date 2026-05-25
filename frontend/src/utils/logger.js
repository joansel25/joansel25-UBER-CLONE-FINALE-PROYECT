/* eslint-disable no-console */
const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

function ts() {
  return new Date().toISOString().slice(11, 23);
}

const logger = {
  info:  (tag, ...args) => { if (DEV) console.log( `[INFO ][${ts()}][${tag}]`, ...args); },
  ok:    (tag, ...args) => { if (DEV) console.log( `[OK   ][${ts()}][${tag}]`, ...args); },
  warn:  (tag, ...args) => { if (DEV) console.warn(`[WARN ][${ts()}][${tag}]`, ...args); },
  error: (tag, ...args) => { if (DEV) console.warn(`[ERROR][${ts()}][${tag}]`, ...args); },
  step:  (tag, ...args) => { if (DEV) console.log( `[STEP ][${ts()}][${tag}]`, ...args); },
};

export default logger;