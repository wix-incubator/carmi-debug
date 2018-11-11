const carlo = require('carlo');
const path = require('path');
const SimpleCompiler = require('carmi/src/simple-compiler');
const Lang = require('carmi/src/lang');

function valToTokenMaybe(token) {
  if (typeof token === 'string') {
    if (token[0] === '*' && token[token.length - 1] === '*') {
      return new Lang.Token(token.replace(/\*/g, ''));
    }
  }
  return token;
}

function convertASTToExpr(expr) {
  if (!Array.isArray(expr)) {
    return valToTokenMaybe(expr);
  }
  const token = new Lang.Token(expr[0].replace(/\*/g, ''));
  return Lang.Expr(token, ...expr.slice(1).map(item => convertASTToExpr(item)));
}

let isTabOpen = false;
let currentInstance = null;
let currentVis = null;
let inMiddleOfStep = false;
let app = false;

const pendingDebugs = [];
const stepsToPromises = new WeakMap();

function getVis() {
  console.log('getVis', currentVis);
  return currentVis;
}

function getInstanceData() {
  const output = JSON.stringify(
    Object.keys(currentInstance)
      .filter(k => k[0] !== '$')
      .reduce((acc, k) => {
        acc[k] = currentInstance[k];
        return acc;
      }, {})
  );
  const nodesList = Object.keys(currentInstance)
    .filter(k => typeof currentInstance[k] !== 'function')
    .map(key => ({ id: key, label: key, title: JSON.stringify(currentInstance[key]) }))
    .concat([{ id: 'output', label: 'output', title: output }])
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
  const ast = currentInstance.$ast();

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
    expr = convertASTToExpr(expr);
    console.log(expr);
    const fnAcc = [];
    const naiveCompiler = new SimpleCompiler({ [topLevel]: expr });
    naiveCompiler.buildExprFunctions(fnAcc, expr);
    const title = fnAcc.join('\n');
    addEdge({ from, to: topLevel, arrows: 'to', label, title });
  }

  Object.keys(ast).forEach(topLevel => mainEdgesInAst(topLevel, ast[topLevel]));
  Object.keys(ast).forEach(topLevel => edgesInAst(topLevel, ast[topLevel]));
  Object.keys(ast).forEach(topLevel => {
    if (topLevel[0] !== '$') {
      addEdge({ from: topLevel, to: 'output', arrows: 'to' });
    }
  });
  const edges = Object.values(edgesMap);
  console.log('get', JSON.stringify({ nodesList, edges }, null, 2));

  return { nodesList, edges };
}

async function openTab() {
  if (!isTabOpen) {
    isTabOpen = true;
    app = await carlo.launch();

    app.on('exit', () => (isTabOpen = false));

    app.serveFolder(path.join(__dirname, 'www'));

    await app.exposeFunction('getVis', _ => getVis);

    await app.load('index.html');
  }
}

async function runSingleStep(step) {
  await openTab();
  const res = app.evaluate(({ nodesList, edges, blocking }) => {
    // create a network
    var container = document.getElementById('mynetwork');
    var data = {
      nodes: new vis.DataSet(nodesList),
      edges: new vis.DataSet(edges)
    };
    var layout = {
      hierarchical: { enabled: true, direction: 'RL', sortMethod: 'directed', levelSeparation: 250 }
    };
    var options = { layout };
    new vis.Network(container, data, options);
    const btn = document.getElementById('step');
    btn.style.display = blocking ? '' : 'none';
    console.log({ blocking });
    if (blocking) {
      const promise = new Promise(resolve => {
        window.resolveWait = resolve;
      });
      return promise;
    }
  }, step);
  await res;
}

async function scheduleNextStep(step) {
  pendingDebugs.push(step);
  if (inMiddleOfStep) {
    return;
  }
  inMiddleOfStep = true;
  while (pendingDebugs.length) {
    step = pendingDebugs.shift();
    await runSingleStep(step);
    stepsToPromises.get(step)();
  }
  inMiddleOfStep = false;
}

function debugInstance(instance, blocking) {
  blocking = blocking || false;
  currentInstance = instance;
  currentVis = getInstanceData();
  const nextStep = { ...currentVis, blocking };
  const promise = new Promise(resolve => {
    stepsToPromises.set(nextStep, resolve);
  });
  scheduleNextStep(nextStep);
  return promise;
}

module.exports = debugInstance;
