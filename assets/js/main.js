let activeTool = 'hoe';
let selectedInventoryKey = null;

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
    if (window.runPython) {
        maxBucket = window.runPython(`quest_tree.get_max_bucket()`) || 5;
        if (userBucket > maxBucket) userBucket = maxBucket;
    }

    document.getElementById('stat-energy').textContent = `${userEnergy} / ${maxEnergy}`;
    document.getElementById('stat-bucket').textContent = `${userBucket} / ${maxBucket} L`;
    document.getElementById('stat-coins').textContent = userCoins;
    
    if (window.runPython) {
        const seasonInfo = window.runPython(`f"{climate_queue.get_current_season()} (Day {climate_queue.current_day})"`);
        const weatherInfo = window.runPython(`climate_queue.get_current_weather()`);
        const aoeInfo = window.runPython(`f"Tool Tier: {quest_tree.get_aoe_range()}x{quest_tree.get_aoe_range()} AOE"`);
        
        if (seasonInfo) document.getElementById('stat-season').textContent = seasonInfo;
        if (weatherInfo) document.getElementById('stat-weather').textContent = weatherInfo;
        if (aoeInfo) document.getElementById('aoe-status').textContent = aoeInfo;
        
        const questDesc = window.runPython(`quest_tree.get_current_quest_desc()`);
        const frogLevel = window.runPython(`quest_tree.current_node.level`);
        const frogTitle = window.runPython(`quest_tree.current_node.title`);
        const frogExp = window.runPython(`quest_tree.current_exp`);
        const reqExp = window.runPython(`quest_tree.exp_to_next_level`);
        
        if (questDesc) document.getElementById('frog-quest-desc').textContent = `"${questDesc}"`;
        if (frogLevel) document.getElementById('frog-level').textContent = `Lvl ${frogLevel}`;
        if (frogTitle) document.getElementById('frog-title').textContent = frogTitle;
        if (frogLevel === 4) document.getElementById('frog-avatar').textContent = "👑";

        const expPercent = Math.min(100, Math.floor((frogExp / reqExp) * 100));
        document.getElementById('frog-exp-bar').style.width = `${expPercent}%`;
    }
}

function setTool(toolName) {
    activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const selectedBtn = document.getElementById(`tool-${toolName}`);
    if (selectedBtn) selectedBtn.classList.add('active');

    logConsole(`Selected Tool: ${toolName.toUpperCase()}`);
}

function refillWaterAtWell() {
    if (activeTool !== 'water') {
        logConsole("⚠️ Select the Water Can tool before clicking the Royal Well!");
        return;
    }
    if (userEnergy < 10) {
        logConsole("❌ Need 10 Energy to refill water at the well!");
        return;
    }
    userEnergy -= 10;
    userBucket = maxBucket;
    window.runPython(`grid.bucket_level = ${maxBucket}`);
    logConsole(`🌊 Refilled watering can to ${maxBucket}L at the Royal Well! (-10 Energy)`);
    updateStatsUI();
}

function handleTileClick(r, c) {
    if (!window.runPython) return;

    if (userEnergy < 5) {
        logConsole("❌ Out of energy! Click End Day to recover.");
        return;
    }

    const aoe = window.runPython(`quest_tree.get_aoe_range()`) || 1;
    let actionExecuted = false;

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
            logConsole(`Tilled soil at tile [${r}, ${c}]`);
            return true;
        }
    } else if (activeTool === 'water') {
        if (userBucket <= 0) {
            logConsole("❌ Water Can is empty (0 L)! Click on the Royal Well to refill.");
            return false;
        }
        const ok = window.runPython(`grid.water_soil(${r}, ${c})`);
        if (ok) {
            userBucket -= 1;
            logConsole(`Watered tile [${r}, ${c}] (-1L Water)`);
            return true;
        }
    } else if (activeTool === 'plant') {
        if (!selectedInventoryKey || !selectedInventoryKey.includes('Seed')) {
            logConsole("❌ Select a seed from your Inventory Hotbar first!");
            return false;
        }
        const itemJson = window.runPython(`json.dumps(inventory_hash.get("${selectedInventoryKey}"))`);
        const item = itemJson ? JSON.parse(itemJson) : null;
        if (!item || item.count <= 0) {
            logConsole(`❌ No ${selectedInventoryKey}s remaining!`);
            return false;
        }

        const cropKey = item.crop_key;
        const planted = window.runPython(`
crop = CROP_DATABASE.get("${cropKey}")
result = grid.plant_seed(${r}, ${c}, crop)
if result:
    inventory_hash.consume("${selectedInventoryKey}")
    True
else:
    False
        `);

        if (planted) {
            logConsole(`🌱 Planted ${cropKey} at tile [${r}, ${c}]`);
            // Reset selected seed key if inventory is exhausted
            const checkRemaining = window.runPython(`json.dumps(inventory_hash.get("${selectedInventoryKey}"))`);
            const remItem = checkRemaining ? JSON.parse(checkRemaining) : null;
            if (!remItem || remItem.count <= 0) {
                selectedInventoryKey = null;
            }
            renderMinecraftHotbar();
            return true;
        } else {
            logConsole(`⚠️ Cannot plant at [${r}, ${c}]! (Tile must be tilled brown soil without existing crops)`);
        }
    } else if (activeTool === 'fertilizer') {
        const applied = window.runPython(`grid.apply_fertilizer(${r}, ${c})`);
        if (applied) {
            logConsole(`🧪 Applied fertilizer to tile [${r}, ${c}]`);
            return true;
        }
    } else if (activeTool === 'scythe') {
        const harvested = window.runPython(`
crop_obj = grid.harvest_crop(${r}, ${c})
if crop_obj:
    inventory_hash.add(crop_obj.name, {"type": "crop", "count": 1, "icon": crop_obj.symbol, "crop_key": crop_obj.name})
    crop_obj.name
else:
    None
        `);

        if (harvested) {
            logConsole(`🌾 Harvested 1x ${harvested} from tile [${r}, ${c}]!`);
            renderMinecraftHotbar();
            return true;
        }
    } else if (activeTool === 'shovel') {
        const removed = window.runPython(`
tile = grid.get_tile(${r}, ${c})
if tile and (tile.crop is not None or tile.is_tilled):
    c_name = tile.crop.name if tile.crop else "tilled soil"
    tile.crop = None
    tile.growth_stage = 0
    tile.is_tilled = False
    tile.is_watered = False
    tile.is_wilted = False
    c_name
else:
    None
        `);
        if (removed) {
            logConsole(`⛏️ Cleared ${removed} from tile [${r}, ${c}]!`);
            return true;
        }
    }
    return false;
}

function advanceNextDay() {
    if (!window.runPython) return;
    
    userEnergy = maxEnergy;
    window.runPython(`climate_queue.advance_day(grid)`);
    
    logConsole("☀️ Advanced to Next Day! Energy restored. Unwatered or out-of-season crops wilted!");
    updateStatsUI();
    window.syncPythonToUI();
}

function submitQuestCrop() {
    if (!selectedInventoryKey) {
        logConsole("❌ Select a harvested crop from your inventory first!");
        return;
    }

    const itemJson = window.runPython(`json.dumps(inventory_hash.get("${selectedInventoryKey}"))`);
    if (!itemJson || itemJson === "null") {
        logConsole(`❌ Invalid item selection!`);
        return;
    }
    const item = JSON.parse(itemJson);
    if (!item || item.type !== 'crop' || item.count <= 0) {
        logConsole(`❌ ${selectedInventoryKey} is not a valid crop!`);
        return;
    }

    const resJson = window.runPython(`
req_crop = quest_tree.current_node.required_crop
if "${selectedInventoryKey}" == req_crop:
    inventory_hash.consume("${selectedInventoryKey}")
    level_up = quest_tree.add_exp(25)
    json.dumps({"success": True, "level_up": level_up, "reward": quest_tree.current_node.perk})
else:
    json.dumps({"success": False})
    `);

    const res = JSON.parse(resJson);
    if (res.success) {
        userCoins += 20;
        logConsole(`🎉 Handed over 1x ${selectedInventoryKey}! Earned +20 Coins & +25 Frog EXP!`);
        if (res.level_up) {
            logConsole(`⭐ FROG PRINCE LEVEL UP! Unlocked Perk: ${res.reward}`);
        }
        selectedInventoryKey = null;
        renderMinecraftHotbar();
        updateStatsUI();
    } else {
        logConsole(`🐸 Frog Prince: "Ribbit! I do not want ${selectedInventoryKey} right now!"`);
    }
}

function buyMysteryBag(tier, cost) {
    // Sync coins with Python engine state if available
    let currentCoins = userCoins;
    
    if (currentCoins < cost) {
        logConsole(`❌ Not enough coins! (Costs ${cost} coins, you have ${currentCoins})`);
        return;
    }
    
    userCoins -= cost;
    
    const resJson = window.runPython(`
crop_obj = buy_seasonal_mystery_bag(${tier}, climate_queue.get_current_season())
if crop_obj:
    seed_name = f"{crop_obj.name} Seed"
    inventory_hash.add(seed_name, {"type": "seed", "count": 1, "icon": "🌱", "crop_key": crop_obj.name})
    json.dumps({"success": True, "name": crop_obj.name})
else:
    # Fallback to Turnip if seasonal selection fails
    inventory_hash.add("Turnip Seed", {"type": "seed", "count": 1, "icon": "🌱", "crop_key": "Turnip"})
    json.dumps({"success": True, "name": "Turnip"})
    `);

    let drawnSeed = "Turnip";
    try {
        const res = JSON.parse(resJson);
        if (res && res.name) drawnSeed = res.name;
    } catch(e) {
        console.error("Error parsing seed response:", e);
    }

    logConsole(`🛒 Purchased Tier ${tier} Mystery Seed Bag for ${cost} Coins! Received: ${drawnSeed} Seed!`);
    updateStatsUI();
    renderMinecraftHotbar();
    closeModal('shop-modal');
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
                const indicator = document.getElementById('active-item-indicator');
                if (indicator) indicator.textContent = `Selected: ${selectedInventoryKey}`;
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
            } else if (tile.tilled) {
                symbol = "🧱";
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