// JS UI State Variables
let activeTool = 'hoe';
let selectedInventoryKey = 'Turnip Seed';

let userEnergy = 100;
const maxEnergy = 100;
let userBucket = 5;
let maxBucket = 5;
let userCoins = 50;

document.addEventListener('DOMContentLoaded', () => {
    renderFallbackGrid();
    updateStatsUI();
});

function updateStatsUI() {
    document.getElementById('stat-energy').textContent = `${userEnergy} / ${maxEnergy}`;
    document.getElementById('stat-bucket').textContent = `${userBucket} / ${maxBucket} L`;
    document.getElementById('stat-coins').textContent = userCoins;
    
    if (window.runPython) {
        const seasonInfo = window.runPython(`f"{climate_queue.get_current_season()} (Day {climate_queue.current_day})"`);
        const weatherInfo = window.runPython(`climate_queue.get_current_weather()`);
        const aoeInfo = window.runPython(`f"Tool Tier: {quest_tree.current_node.perk} ({quest_tree.get_aoe_range()}x{quest_tree.get_aoe_range()})"`);
        
        if (seasonInfo) document.getElementById('stat-season').textContent = seasonInfo;
        if (weatherInfo) document.getElementById('stat-weather').textContent = weatherInfo;
        if (aoeInfo) document.getElementById('aoe-status').textContent = aoeInfo;
        
        // Sync Frog Quest Info
        const questDesc = window.runPython(`quest_tree.get_current_quest_desc()`);
        const frogLevel = window.runPython(`quest_tree.current_node.level`);
        const frogTitle = window.runPython(`quest_tree.current_node.title`);
        
        if (questDesc) document.getElementById('frog-quest-desc').textContent = `"${questDesc}"`;
        if (frogLevel) document.getElementById('frog-level').textContent = `Lvl ${frogLevel}`;
        if (frogTitle) document.getElementById('frog-title').textContent = frogTitle;
        if (frogLevel === 4) document.getElementById('frog-avatar').textContent = "👑";
    }
}

function setTool(toolName) {
    activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const selectedBtn = document.getElementById(`tool-${toolName}`);
    if (selectedBtn) selectedBtn.classList.add('active');

    logConsole(`Selected Action Tool: ${toolName.toUpperCase()}`);
}

function handleTileClick(r, c) {
    if (!window.runPython) return;

    if (activeTool === 'refill') {
        if (userEnergy < 10) {
            logConsole("❌ Need 10 Energy to refill bucket at the well!");
            return;
        }
        userEnergy -= 10;
        userBucket = maxBucket;
        window.runPython(`grid.bucket_level = ${maxBucket}`);
        logConsole("🌊 Refilled bucket to full capacity (5L) at the well! (-10 Energy)");
        updateStatsUI();
        return;
    }

    if (userEnergy < 5) {
        logConsole("❌ Out of energy! End Day to recover.");
        return;
    }

    const aoe = window.runPython(`quest_tree.get_aoe_range()`) || 1;
    let actionExecuted = false;

    // Loop through AOE tiles
    for (let dr = 0; dr < aoe; dr++) {
        for (let dc = 0; dc < aoe; dc++) {
            const tr = r + dr;
            const tc = c + dc;
            if (tr < 5 && tc < 5) {
                if (executeToolOnTile(tr, tc)) actionExecuted = true;
            }
        }
    }

    if (actionExecuted) {
        userEnergy -= 5;
        updateStatsUI();
        window.syncPythonToUI();
    }
}

function executeToolOnTile(r, c) {
    if (activeTool === 'hoe') {
        const ok = window.runPython(`grid.till_soil(${r}, ${c})`);
        if (ok) {
            window.runPython(`stack.push({"action": "till", "r": ${r}, "c": ${c}})` );
            logConsole(`Tilled tile [${r}, ${c}]`);
            return true;
        }
    } else if (activeTool === 'water') {
        if (userBucket <= 0) {
            logConsole("❌ Water Can is empty (0/5 L)! Use 'Refill Bucket' tool.");
            return false;
        }
        const ok = window.runPython(`grid.water_soil(${r}, ${c})`);
        if (ok) {
            userBucket -= 1;
            window.runPython(`stack.push({"action": "water", "r": ${r}, "c": ${c}})` );
            logConsole(`Watered tile [${r}, ${c}] (-1L Water)`);
            return true;
        }
    } else if (activeTool === 'plant') {
        if (!selectedInventoryKey || !selectedInventoryKey.includes('Seed')) {
            logConsole("❌ Select a seed from the Inventory Hotbar first!");
            return false;
        }
        const item = JSON.parse(window.runPython(`json.dumps(inventory_hash.get("${selectedInventoryKey}"))`));
        if (!item || item.count <= 0) {
            logConsole(`❌ No ${selectedInventoryKey}s remaining!`);
            return false;
        }

        const cropKey = item.crop_key;
        const planted = window.runPython(`
crop = CROP_DATABASE.get("${cropKey}")
if grid.plant_seed(${r}, ${c}, crop):
    inventory_hash.consume("${selectedInventoryKey}")
    stack.push({"action": "plant", "r": ${r}, "c": ${c}, "seed_key": "${selectedInventoryKey}"})
    True
else:
    False
        `);

        if (planted) {
            logConsole(`🌱 Planted ${cropKey} at [${r}, ${c}]`);
            renderMinecraftHotbar();
            return true;
        }
    } else if (activeTool === 'fertilizer') {
        const applied = window.runPython(`grid.apply_fertilizer(${r}, ${c})`);
        if (applied) {
            logConsole(`🧪 Applied fertilizer to [${r}, ${c}] (-1 Growth Day Required)`);
            return true;
        }
    } else if (activeTool === 'scythe') {
        const harvested = window.runPython(`
crop_obj = grid.harvest_crop(${r}, ${c})
if crop_obj:
    inventory_hash.add(crop_obj.name, {"type": "crop", "count": 1, "icon": crop_obj.symbol, "crop_key": crop_obj.name})
    stack.push({"action": "harvest", "r": ${r}, "c": ${c}})
    crop_obj.name
else:
    None
        `);

        if (harvested) {
            logConsole(`🌾 Harvested 1x ${harvested} from [${r}, ${c}]!`);
            renderMinecraftHotbar();
            return true;
        }
    } else if (activeTool === 'shovel') {
        // Undo/remove seed using shovel
        const removed = window.runPython(`
tile = grid.get_tile(${r}, ${c})
if tile and tile.crop:
    c_name = tile.crop.name
    tile.crop = None
    tile.growth_stage = 0
    c_name
else:
    None
        `);
        if (removed) {
            logConsole(`⛏️ Dug up seed/crop ${removed} at [${r}, ${c}]!`);
            return true;
        }
    }
    return false;
}

function advanceNextDay() {
    if (!window.runPython) return;
    
    userEnergy = maxEnergy;
    window.runPython(`climate_queue.advance_day(grid)`);
    
    logConsole("☀️ Advanced to Next Day! Energy restored. Out-of-season crops wilted!");
    updateStatsUI();
    window.syncPythonToUI();
}

function submitQuestCrop() {
    if (!selectedInventoryKey) {
        logConsole("❌ Select a harvested crop from your inventory first!");
        return;
    }

    const item = JSON.parse(window.runPython(`json.dumps(inventory_hash.get("${selectedInventoryKey}"))`));
    if (!item || item.type !== 'crop' || item.count <= 0) {
        logConsole(`❌ ${selectedInventoryKey} is not a valid harvested crop in your inventory!`);
        return;
    }

    const success = window.runPython(`
req_crop = quest_tree.current_node.required_crop
if "${selectedInventoryKey}" == req_crop:
    inventory_hash.consume("${selectedInventoryKey}")
    quest_tree.advance_quest()
    True
else:
    False
    `);

    if (success) {
        userCoins += 50;
        logConsole(`🎉 Quest Fulfilled! Handed over ${selectedInventoryKey}. Earned +50 Coins & Levelled up Frog!`);
        renderMinecraftHotbar();
        updateStatsUI();
    } else {
        logConsole(`🐸 Frog Prince: "Ribbit! I do not want ${selectedInventoryKey} right now!"`);
    }
}

function buyMysteryBag(tier, cost) {
    if (userCoins < cost) {
        alert("Not enough coins!");
        return;
    }
    userCoins -= cost;
    
    const drawnSeed = window.runPython(`
bag_result = buy_seasonal_mystery_bag(${tier}, climate_queue.get_current_season())
inventory_hash.add(f"{bag_result.name} Seed", {"type": "seed", "count": 1, "icon": "🌱", "crop_key": bag_result.name})
bag_result.name
    `);

    logConsole(`🛒 Bought Tier ${tier} Seed Bag! Drew: ${drawnSeed} Seed!`);
    updateStatsUI();
    renderMinecraftHotbar();
    closeModal('shop-modal');
}

function buyFertilizer(cost) {
    if (userCoins < cost) {
        alert("Not enough coins!");
        return;
    }
    userCoins -= cost;
    logConsole("🛒 Purchased Fertilizer!");
    updateStatsUI();
    closeModal('shop-modal');
}

function handleUndo() {
    if (!window.runPython) return;
    const undone = window.runPython(`stack.pop()`);
    if (undone) {
        logConsole(`↩️ Undone last action!`);
        window.syncPythonToUI();
    } else {
        logConsole("Nothing in stack to undo.");
    }
}

function renderMinecraftHotbar() {
    const gridEl = document.getElementById('mc-inventory-grid');
    if (!gridEl || !window.runPython) return;
    gridEl.innerHTML = '';

    const items = JSON.parse(window.runPython(`json.dumps(inventory_hash.to_list())`));

    for (let i = 0; i < 6; i++) {
        const item = items[i];
        const slotEl = document.createElement('div');
        slotEl.className = 'mc-slot';

        if (item && item.count > 0) {
            if (item.key === selectedInventoryKey) slotEl.classList.add('selected');

            slotEl.innerHTML = `
                <span class="mc-slot-label">${item.type.toUpperCase()}</span>
                <span>${item.icon}</span>
                <span class="mc-badge">${item.count}</span>
            `;

            slotEl.onclick = () => {
                selectedInventoryKey = item.key;
                document.getElementById('active-item-indicator').textContent = `Selected: ${selectedInventoryKey}`;
                renderMinecraftHotbar();
            };
        } else {
            slotEl.innerHTML = `<span style="opacity:0.2; font-size:0.6rem;">Empty</span>`;
        }
        gridEl.appendChild(slotEl);
    }
}

window.syncPythonToUI = function() {
    if (!window.runPython) return;

    const jsonStr = window.runPython(`
import json
json.dumps([
    [{
        "tilled": t.is_tilled,
        "watered": t.is_watered,
        "wilted": t.is_wilted,
        "symbol": t.crop.symbol if t.crop else "",
        "stage": t.growth_stage,
        "max_stage": t.crop.days_to_grow if t.crop else 1
    } for t in row]
    for row in grid.grid
])
    `);

    if (jsonStr) {
        renderGridFromMatrix(JSON.parse(jsonStr));
    }
    renderMinecraftHotbar();
};

function renderGridFromMatrix(matrix) {
    const gridContainer = document.getElementById('soil-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    matrix.forEach((row, r) => {
        row.forEach((tile, c) => {
            const el = document.createElement('div');
            el.className = 'soil-tile';
            if (tile.tilled) el.classList.add('tilled');
            if (tile.watered) el.classList.add('watered');
            if (tile.wilted) el.classList.add('wilted');

            let symbol = "🟫";
            if (tile.wilted) {
                symbol = "🥀";
            } else if (tile.symbol) {
                if (tile.stage === 0) symbol = "🌱";
                else if (tile.stage < tile.max_stage) symbol = "🌿";
                else symbol = tile.symbol;
            }

            el.innerHTML = `
                <span style="font-size: 8px; color: rgba(253,230,138,0.5); align-self: flex-start;">${r},${c}</span>
                <span style="font-size: 1.25rem;">${symbol}</span>
            `;
            el.onclick = () => handleTileClick(r, c);
            gridContainer.appendChild(el);
        });
    });
}

function renderFallbackGrid() {
    const gridContainer = document.getElementById('soil-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const el = document.createElement('div');
            el.className = 'soil-tile';
            el.innerHTML = `<span style="font-size: 8px; color: rgba(253,230,138,0.5); align-self: flex-start;">${r},${c}</span><span>🟫</span>`;
            gridContainer.appendChild(el);
        }
    }
}

function logConsole(msg) {
    const el = document.getElementById('output-console');
    if (el) el.textContent = `> ${msg}\n` + el.textContent;
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function updateCodeViewer() {
    const selector = document.getElementById('file-selector');
    const viewer = document.getElementById('code-viewer');
    if (selector && viewer && window.pythonModules) {
        viewer.textContent = window.pythonModules[selector.value] || "# Code loading...";
    }
}
window.updateCodeViewer = updateCodeViewer;