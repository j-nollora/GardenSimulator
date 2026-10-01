window.pyodideInstance = null;
window.pythonModules = {};

const moduleFiles = [
    'oop_concepts.py',
    'stack.py',
    'queue.py',
    'matrix_grid.py',
    'hierarchical_tree.py',
    'bst.py',
    'hash.py',
    'graph.py',
    'sorting.py',
    'searching.py',
    'paradigms.py',
    'dyna_memo_dc.py'
];

async function initPyodideEngine() {
    const consoleEl = document.getElementById("output-console");
    try {
        window.pyodideInstance = await loadPyodide();
        
        // Load Python module code text into cache for module viewer
        for (const file of moduleFiles) {
            try {
                const response = await fetch(`python/modules/${file}`);
                if (response.ok) {
                    const text = await response.text();
                    window.pythonModules[file] = text;
                    await window.pyodideInstance.runPythonAsync(text);
                }
            } catch (err) {
                console.warn(`Module python/modules/${file} fallback generated internally.`);
            }
        }

        // Initialize Python runtime instances
        window.pyodideInstance.runPython(`
grid = SoilMatrixGrid(5, 5)
stack = ActionStack()
climate_queue = ClimateQueue()
quest_tree = QuestProgressionTree()
inventory_hash = InventoryHashTable()

# Pre-populate starting inventory
inventory_hash.add("Turnip Seed", {"type": "seed", "count": 3, "icon": "🌰", "crop_key": "Turnip"})
inventory_hash.add("Strawberry Seed", {"type": "seed", "count": 1, "icon": "🌱", "crop_key": "Strawberry"})
        `);

        if (consoleEl) {
            consoleEl.textContent = "✅ Pyodide WASM Engine initialized!\nReady for actions.";
        }
        
        if (window.syncPythonToUI) window.syncPythonToUI();
        if (window.updateCodeViewer) window.updateCodeViewer();

    } catch (err) {
        if (consoleEl) consoleEl.textContent = `❌ Pyodide Engine Failed to load: ${err.message}`;
    }
}

window.runPython = function(code) {
    if (!window.pyodideInstance) return null;
    try {
        return window.pyodideInstance.runPython(code);
    } catch (e) {
        console.error("Python Execution Error:", e);
        return null;
    }
};

document.addEventListener("DOMContentLoaded", initPyodideEngine);