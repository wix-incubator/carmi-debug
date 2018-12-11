const carlo = require('carlo');
const path = require('path');
const ARSON = require('arson');

let isTabOpen = false;
let currentInstance = null;
let currentVis = null;
let inMiddleOfStep = false;
let app = false;
let currentStep = null;

const pendingDebugs = [];
const stepsToPromises = new WeakMap();

function getInstanceData() {
  const value = ARSON.stringify(currentInstance);
  const ast = currentInstance.$ast();
  const sources = currentInstance.$source();
  return { value, ast, sources };
}

async function openTab() {
  if (!isTabOpen) {
    isTabOpen = true;
    app = await carlo.launch();

    app.on('exit', async () => {
      isTabOpen = false;
      try {
        await carlo.close();
      } catch (e) {

      }
    });

    app.serveFolder(path.join(__dirname, 'www'));

    await app.exposeFunction('getCurrentStep', _ => currentStep);

    await app.load('index.html');
  }
}

async function runSingleStep() {
  await openTab();
  const res = app.evaluate(() => {
    // create a network
    async function runStepInBrowser() {
      const step = await getCurrentStep();
      updateViewer(step);
      if (step.blocking) {
        const promise = new Promise(resolve => {
          window.resolveWait = resolve;
        });
        await promise;
      }
    }
    runStepInBrowser();

  });
  await res;
}

async function scheduleNextStep(step) {
  pendingDebugs.push(step);
  if (inMiddleOfStep) {
    return;
  }
  inMiddleOfStep = true;
  try {
    while (pendingDebugs.length) {
      currentStep = pendingDebugs.shift();
      await runSingleStep();
      stepsToPromises.get(currentStep)();
    }
  } catch (e) {
    console.error(e);
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
