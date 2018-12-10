const graphDiv = document.getElementById('graph');
const sourceDiv = document.getElementById('sources');
const filesDiv = document.getElementById('files');
const codeDiv = document.getElementById('code');
const viewGraphButton = document.getElementById('viewGraph');
const viewSourcesButton = document.getElementById('viewSources');
const nextButton =  document.getElementById('viewSources');

function switchView(graph) {
  graphDiv.style.visibility = graph ? '' : 'hidden';
  sourceDiv.style.visibility = graph ? 'hidden' : '';
  viewSourcesButton.style.display = graph ? '' : 'none';
  viewGraphButton.style.display = graph ? 'none' : '';
}
nextButton.onclick = () => {
    window.resolveWait();
}

module.exports = {
  switchView,
  graphDiv,
  sourceDiv,
  filesDiv,
  codeDiv,
  viewGraphButton,
  viewSourcesButton
};
