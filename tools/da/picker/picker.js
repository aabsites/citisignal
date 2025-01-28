// Import SDK
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

(async function init() {
  const { context, token, actions } = await DA_SDK;
  const div = document.createElement('div');
  div.innerHTML = `<h1>Hello World</h1>`;

  const btn = document.createElement('button');
  btn.innerText = 'Push me!';

  btn.addEventListener('click', () => {
    actions.sendText('I was pushed!');
    actions.closeLibrary();
  });
  
  document.body.append(div, btn);
}());
