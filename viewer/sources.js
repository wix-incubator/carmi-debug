const { getData } = require('./data');
const { filesDiv, codeDiv } = require('./dom');
const hljs = require('highlight.js/lib/highlight');
const javascript = require('highlight.js/lib/languages/javascript');
hljs.registerLanguage('javascript', javascript);

function toLineCol(str) {
  const rawParts = str.split('_');
  const parts = rawParts.slice(2).map(v => parseInt(v, 10));
  return { line: parts[0] - 1, col: parts[1] - 1 + rawParts[0].length - 1 };
}

function tryStringify(val) {
    try {
        return JSON.stringify(val, null, 2)
    } catch (e) {
        return '';
    }
}

function buildSourceFile({ sources, value, file }) {
  const src = sources[file];
  console.log(src);
  const keys = Object.keys(value).filter(key => key.indexOf('_' + file + '_') !== -1);
  const keysToLineCol = keys.reduce((acc, k) => {
    acc[k] = toLineCol(k);
    return acc;
  }, {});
  keys.sort((a, b) => {
    a = keysToLineCol[a];
    b = keysToLineCol[b];
    if (a.line < b.line || (a.line === b.line && a.col < b.col)) {
      return -1;
    } else if (a.line === b.line && a.col === b.col) {
      return 0;
    } else {
      return 1;
    }
  });
  lines = src.split('\n');
  keys.reverse();
  keys.forEach(key => {
    const loc = keysToLineCol[key];
    lines[loc.line] =
      lines[loc.line].substr(0, loc.col) + `/* CARMI-DEBUG ${key} CARMI-DEBUG */` + lines[loc.line].substr(loc.col);
  });
  codeDiv.innerHTML = `<pre><code class="javascript">${lines.join('\n')}</code></pre>`;
  hljs.highlightBlock(codeDiv.firstChild);
  const comments = Array.from(codeDiv.getElementsByClassName('hljs-comment'));
  comments.forEach(tag => {
    if (tag.innerText.indexOf('/* CARMI-DEBUG') !== -1) {
      const key = tag.innerText.split(' CARMI-DEBUG ')[1];
      tag.innerHTML = `<pre class="content">${tryStringify(value[key])}</pre>`;
      tag.classList = ['annotate'];
      console.log(tag.className);
    }
  });
}

let addedListenerToFiles = false;

function buildSources() {
  const { value, sources } = getData();
  if (!addedListenerToFiles) {
    addedListenerToFiles = true;
    filesDiv.onclick = evt => {
      const { value, sources } = getData();
      if (evt.target.tagName === 'BUTTON') {
        buildSourceFile({ value, sources, file: evt.target.innerText });
      }
    };
  }
  const files = Object.keys(sources);
  buildSourceFile({ value, sources, file: files[0] });
  filesDiv.innerHTML = files.map(fileName => `<button>${fileName}</button>`).join('');
}

module.exports = buildSources;
