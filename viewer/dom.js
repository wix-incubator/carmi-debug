const sourceDiv = document.getElementById('sources');
const filesDiv = document.getElementById('files');
const codeDiv = document.getElementById('code');
const nextButton =  document.getElementById('step');

nextButton.onclick = () => {
    window.resolveWait();
}

module.exports = {
  sourceDiv,
  filesDiv,
  codeDiv
};
