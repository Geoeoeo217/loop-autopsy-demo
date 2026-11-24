/* The playground's Python: Pyodide in a Web Worker, running the real loop-autopsy from PyPI inside an
   IPython shell. A worker keeps the page responsive, and the page can end it if a loop ever runs away. */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let py = null;

async function boot() {
  py = await loadPyodide();
  await py.loadPackage('micropip');
  postMessage({ type: 'status', text: 'Installing loop-autopsy from PyPI…' });
  await py.runPythonAsync(`
import micropip
await micropip.install(["ipython", "loop-autopsy==0.4.0"])

# The browser cannot start threads, and loop-autopsy's watchdog runs in one. The checks that run
# inside each loop round (stuck, cycle, wrong direction, jumped over, growing list, recursion) do
# not need it, so the watchdog is switched off here.
import threading
threading.Thread.start = lambda self: None

import io, sys
from IPython.core.interactiveshell import InteractiveShell
shell = InteractiveShell.instance(colors="NoColor")

def run_cell(code):
    out = io.StringIO()
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    try:
        result = shell.run_cell(code, store_history=True)
    finally:
        sys.stdout, sys.stderr = old
    return out.getvalue(), bool(result.success)

run_cell("%load_ext loop_autopsy")
`);
  const [text] = py.globals.get('run_cell')('%autopsy status').toJs();
  postMessage({ type: 'ready', text: 'loop-autopsy 0.4.0 is watching your loops.', status: text });
}

const booting = boot().catch((e) => postMessage({ type: 'error', text: String(e) }));

onmessage = async (e) => {
  await booting;
  if (!py) return;
  const t0 = performance.now();
  try {
    const [text, ok] = py.globals.get('run_cell')(e.data.code).toJs();
    postMessage({ type: 'result', id: e.data.id, text, ok, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    postMessage({ type: 'result', id: e.data.id, text: String(err), ok: false, ms: Math.round(performance.now() - t0) });
  }
};
