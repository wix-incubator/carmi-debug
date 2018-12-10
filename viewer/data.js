const currentData = [];

function setData({ value, ast, sources }) {
  currentData.splice(0, currentData.length, { value, ast, sources });
}

function getData() {
  const { value, ast, sources } = currentData[0];
  return { value, ast, sources };
}

module.exports = { setData, getData };
