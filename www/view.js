const graphDiv = document.getElementById('graph');
const sourceDiv = document.getElementById('sources');
const filesDiv = document.getElementById('files');
const codeDiv = document.getElementById('code');
const viewGraphButton = document.getElementById('viewGraph');
const viewSourcesButton = document.getElementById('viewSources');
const currentData = [];

function setData({ value, ast, sources }) {
    currentData.splice(0, currentData.length, { value, ast, sources })
}

function getData() {
    const { value, ast, sources } = currentData[0];
    return { value, ast, sources };
}

function buildGraph() {
    const { value, ast } = getData();
    const output = JSON.stringify(
        Object.keys(value)
            .filter(k => k[0] !== '$')
            .reduce((acc, k) => {
                acc[k] = value[k];
                return acc;
            }, {}),
        null,
        2
    );
    const nodesList = Object.keys(value)
        .filter(k => typeof value[k] !== 'function')
        .map(key => ({ id: key, label: key, title: `<pre>${JSON.stringify(value[key], null, 2)}</pre>` }))
        .concat([{ id: 'output', label: 'output', title: `<pre>${output}</pre>` }])
        .map(val => ({ ...val, widthConstraint: 150, heightConstraint: 30 }));
    // create an array with nodes
    const edgesMap = {};

    function addEdge(edge) {
        const key = `${edge.from}->${edge.to}`;
        console.log(key, edge);
        edgesMap[key] = edgesMap[key] || edge;
    }
    function edgesInAst(topLevel, expr) {
        if (expr === '*root*') {
            addEdge({ from: '$model', to: topLevel, arrows: 'to', dashes: true });
            return;
        }
        if (!Array.isArray(expr)) {
            return;
        }
        if (expr[0] === '*get*' && expr[2] === '*topLevel*') {
            addEdge({ from: expr[1], to: topLevel, arrows: 'to', dashes: true });
        }
        if (expr[0] === '*recursiveMapValues*' || expr[0] === '*recursiveMap*') {
            addEdge({ from: topLevel, to: topLevel, arrows: 'to', selfReferenceSize: 10 });
        }
        expr.forEach(child => edgesInAst(topLevel, child));
    }

    function lastTopLevelInExpr(expr) {
        if (!Array.isArray(expr)) {
            if (expr === '*root*') {
                return '$model';
            }
            return null;
        }
        if (expr[0] === '*func*') {
            return null;
        }
        if (expr[0] === '*get*' && expr[2] === '*topLevel*') {
            return expr[1];
        }

        for (let i = expr.length - 1; i >= 0; i--) {
            const res = lastTopLevelInExpr(expr[i]);
            if (res) {
                return res;
            }
        }
        return null;
    }

    function mainEdgesInAst(topLevel, expr) {
        const label = expr[0].replace(/\*/g, '');
        const from = lastTopLevelInExpr(expr);
        addEdge({ from, to: topLevel, arrows: 'to', label });
    }

    Object.keys(ast).forEach(topLevel => mainEdgesInAst(topLevel, ast[topLevel]));
    Object.keys(ast).forEach(topLevel => edgesInAst(topLevel, ast[topLevel]));
    Object.keys(ast).forEach(topLevel => {
        if (topLevel[0] !== '$') {
            addEdge({ from: topLevel, to: 'output', arrows: 'to' });
        }
    });
    const edges = Object.values(edgesMap);
    var data = {
        nodes: new vis.DataSet(nodesList),
        edges: new vis.DataSet(edges)
    };
    var layout = {
        hierarchical: { enabled: true, direction: 'RL', sortMethod: 'directed', levelSeparation: 250 }
    };
    var options = { layout };
    new vis.Network(graphDiv, data, options);
}

function toLineCol(str) {
    const rawParts = str.split('_')
    const parts = rawParts.slice(2).map(v => parseInt(v, 10));
    return { line: parts[0] - 1, col: parts[1] - 1 + rawParts[0].length - 1 }
}

function buildSourceFile({ sources, value, file }) {
    const src = sources[file];
    console.log(src);
    const keys = Object.keys(value).filter(key => key.indexOf('_' + file + '_') !== -1);
    const keysToLineCol = keys.reduce((acc, k) => {
        acc[k] = toLineCol(k);
        return acc;
    }, {})
    keys.sort((a, b) => {
        a = keysToLineCol[a];
        b = keysToLineCol[b];
        if (a.line < b.line || (a.line === b.line && a.col < b.col)) {
            return -1
        } else if (a.line === b.line && a.col === b.col) {
            return 0;
        } else {
            return 1
        }
    });
    lines = src.split('\n')
    keys.reverse();
    keys.forEach(key => {
        const loc = keysToLineCol[key];
        lines[loc.line] = lines[loc.line].substr(0, loc.col) + `/* CARMI-DEBUG ${key} CARMI-DEBUG */` + lines[loc.line].substr(loc.col)
    })
    codeDiv.innerHTML = `<pre><code class="javascript">${lines.join('\n')}</code></pre>`
    hljs.highlightBlock(codeDiv.firstChild);
    const comments = Array.from(codeDiv.getElementsByClassName('hljs-comment'));
    comments.forEach(tag => {
        if (tag.innerText.indexOf('/* CARMI-DEBUG') !== -1) {
            const key = tag.innerText.split(' CARMI-DEBUG ')[1];
            tag.innerHTML = `<pre class="content">${JSON.stringify(value[key], null, 2)}</pre>`;
            tag.classList = ['annotate'];
            console.log(tag.className);
        }
    })

}

function buildSources() {
    const { value, sources } = getData()
    const files = Object.keys(sources);
    buildSourceFile({ value, sources, file: files[0] })
    filesDiv.innerHTML = files.map(fileName => `<button>${fileName}</button>`).join('')
}

filesDiv.onclick = (evt) => {
    const { value, sources } = getData()
    if (evt.target.tagName === 'BUTTON') {
        buildSourceFile({ value, sources, file: evt.target.innerText})
    }
}

function switchView(graph) {
    graphDiv.style.visibility = graph ? '' : 'hidden';
    sourceDiv.style.visibility = graph ? 'hidden' : '';
    viewSourcesButton.style.display = graph ? '' : 'none';
    viewGraphButton.style.display = graph ? 'none' : '';
}

switchView(false);