// Web Worker: o three.js, a montagem da cena e cada frame rodam fora da thread principal.
import { createController } from './controller.js';

let controller = null;

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    controller = createController(data.canvas, data.state, (msg) => self.postMessage(msg));
  } else {
    controller?.handle(data);
  }
};
