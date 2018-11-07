const { compile, chain, root, and, ternary, or, arg0, arg1, setter, splice, withName } = require('carmi');
const carmiDebug = require('./index.js');

const compiler = 'optimizing';
async function test() {
  console.log('start');
  const negated = withName('negated', root.map(val => val.not()));
  const model = { doubleNegated: negated.map(val => val.not()), set: setter(arg0) };

  const sourceCode = await compile(model, { compiler, debug: true });
  const optCode = eval(sourceCode);
  const inst = optCode([false, 1, 0], {});
  carmiDebug(inst, true);
  inst.set(0, true);
  carmiDebug(inst, true);

  console.log('done');
}

test().catch(e => console.error(e));
