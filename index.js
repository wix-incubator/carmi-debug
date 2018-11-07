const carlo = require('carlo');
const path = require('path');
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
    .concat([{ id: 'output', label: 'output', title: output }]);
  // create an array with nodes
  const edges = [];
  function edgesInAst(topLevel, node) {
    if (node === '*root*') {
      edges.push({ from: '$model', to: topLevel, arrows: 'to' });
      return;
    }
    if (!Array.isArray(node)) {
      return;
    }
    if (node[0] === '*get*' && node[2] === '*topLevel*') {
      edges.push({ from: node[1], to: topLevel, arrows: 'to' });
    }
    node.forEach(child => edgesInAst(topLevel, child));
  }
  const ast = currentInstance.$ast();

  Object.keys(ast).forEach(topLevel => edgesInAst(topLevel, ast[topLevel]));
  Object.keys(ast).forEach(topLevel => {
    if (topLevel[0] !== '$') {
      edges.push({ from: topLevel, to: 'output', arrows: 'to' });
    }
  });

  console.log('get', { node: { nodesList, edges } });

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
      hierarchical: { enabled: true, direction: 'RL', sortMethod: 'directed' }
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
