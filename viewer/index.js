const {setData} = require('./data');
const buildSources = require('./sources');
const ARSON = require('arson');

function updateViewer({ value, ast, sources, blocking }) {
    value = ARSON.decode(value);
    setData({ value, ast, sources })
    buildSources();
    const btn = document.getElementById('step');

    btn.style.display = blocking ? '' : 'none';
    console.log({ blocking });
    return blocking;
}

module.exports = updateViewer;