/// <reference lib="dom" />

// Load the worker
const readerWorker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});

function onFileInputChange(event) {
  console.log(event);
  /** @type {File} */
  const file = event.target.files[0];
  if (!file) return;
  const stream = file.stream();
  readerWorker.postMessage({ stream }, [stream]);
}

readerWorker.onmessage = event => {
  console.log(event.data);
};

document.getElementById('file').addEventListener('change', onFileInputChange);
