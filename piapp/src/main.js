import { QC } from './app/AppRoot.js';
import { Um, c } from './shared.js';

console.log("MAIN.JS: Starting React app render");
const rootElement = document.getElementById("root");
console.log("MAIN.JS: Root element:", rootElement);
const root = Um(rootElement);
console.log("MAIN.JS: React root created:", root);
root.render(c.jsx(QC, {}));
console.log("MAIN.JS: React render called");
