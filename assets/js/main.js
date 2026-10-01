let activeTool = 'hoe';
let selectedInventoryKey = null;

let userEnergy = 100;
const maxEnergy = 100;
let userBucket = 5;
let maxBucket = 5;
let userCoins = 100;

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
        // Fetch current season and reset season-day count directly from Python instance
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
        const count = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("count", 0) if item else 0
        `);
        if (!count || count <= 0) {
            logConsole(`❌ No ${selectedInventoryKey}s remaining!`);
            return false;
        }

        const cropKey = selectedInventoryKey.replace(" Seed", "");
        const planted = window.runPython(`grid.plant_seed(${r}, ${c}, CROP_DATABASE.get("${cropKey}"))`);

        if (planted) {
            window.runPython(`inventory_hash.consume("${selectedInventoryKey}")`);
            logConsole(`🌱 Planted ${cropKey} at tile [${r}, ${c}]`);
            
            const remCount = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("count", 0) if item else 0
            `);
            if (!remCount || remCount <= 0) {
                selectedInventoryKey = null;
            }
            renderMinecraftHotbar();
            return true;
        } else {
            logConsole(`⚠️ Cannot plant at [${r}, ${c}]! (Tile must be tilled soil without existing crops)`);
        }
    } else if (activeTool === 'fertilizer') {
        if (!selectedInventoryKey || selectedInventoryKey !== 'Fertilizer') {
            logConsole("❌ Select Fertilizer from your Inventory Hotbar first! (Purchase from Frog Shop)");
            return false;
        }
        const count = window.runPython(`
item = inventory_hash.get("Fertilizer")
item.get("count", 0) if item else 0
        `);
        if (!count || count <= 0) {
            logConsole("❌ Out of Fertilizer! Purchase more from the Frog Shop.");
            return false;
        }

        const applied = window.runPython(`grid.apply_fertilizer(${r}, ${c})`);
        if (applied) {
            window.runPython(`inventory_hash.consume("Fertilizer")`);
            logConsole(`🧪 Applied fertilizer defense shield to tile [${r}, ${c}]!`);
            
            const remCount = window.runPython(`
item = inventory_hash.get("Fertilizer")
item.get("count", 0) if item else 0
            `);
            if (!remCount || remCount <= 0) {
                selectedInventoryKey = null;
            }
            renderMinecraftHotbar();
            return true;
        } else {
            logConsole(`⚠️ Cannot apply fertilizer at [${r}, ${c}]! (Requires an unshielded active crop)`);
        }
    } else if (activeTool === 'scythe') {
        window.runPython(`
_tile = grid.get_tile(${r}, ${c})
_has_crop = _tile.crop is not None if _tile else False
_is_ready = (_tile.growth_stage >= _tile.crop.days_to_grow) if (_tile and _tile.crop) else False
_temp_harvested = grid.harvest_crop(${r}, ${c})
        `);

        const hasCrop = window.runPython(`_has_crop`);
        const isReady = window.runPython(`_is_ready`);
        const harvestedName = window.runPython(`_temp_harvested.name if _temp_harvested else None`);
        const harvestedSymbol = window.runPython(`_temp_harvested.symbol if _temp_harvested else ''`);

        if (harvestedName && harvestedName !== 'None') {
            window.runPython(`inventory_hash.add("${harvestedName}", {"type": "crop", "count": 1, "icon": "${harvestedSymbol}", "crop_key": "${harvestedName}"})`);
            logConsole(`🌾 Harvested 1x ${harvestedName} from tile [${r}, ${c}]!`);
            renderMinecraftHotbar();
            return true;
        } else if (hasCrop && !isReady) {
            logConsole(`⚠️ Crop at [${r}, ${c}] is not ready for harvest yet!`);
        } else {
            logConsole(`⚠️ There is nothing to harvest at tile [${r}, ${c}]!`);
        }
    
    } else if (activeTool === 'shovel') {
        window.runPython(`
_tile = grid.get_tile(${r}, ${c})
_removed_item = None
if _tile and (_tile.crop is not None or _tile.is_tilled):
    _removed_item = _tile.crop.name if _tile.crop else "tilled soil"
    _tile.crop = None
    _tile.growth_stage = 0
    _tile.is_tilled = False
    _tile.is_watered = False
    _tile.is_wilted = False
    _tile.is_fertilized = False
    _tile.hp = 100
        `);
        const removed = window.runPython(`_removed_item`);

        if (removed && removed !== 'None') {
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
    
    const disasterOccurred = window.runPython(`grid.disaster_occurred`);
    const disasterName = window.runPython(`grid.last_disaster_name`);
    const gridEl = document.getElementById('soil-grid');

    if (disasterOccurred && disasterName) {
        logConsole(`🚨 NIGHT DISASTER ALERT: A severe [${disasterName}] struck your field! Shielded crops absorbed damage!`);
        if (gridEl) {
            gridEl.classList.add('disaster-blink');
            setTimeout(() => gridEl.classList.remove('disaster-blink'), 3000);
        }
    } else {
        logConsole("☀️ Advanced to Next Day! Energy restored. Unwatered or out-of-season crops wilted!");
    }

    updateStatsUI();
    window.syncPythonToUI();
}

function submitQuestCrop() {
    if (!selectedInventoryKey) {
        logConsole("❌ Select a harvested crop from your inventory first!");
        return;
    }

    const isCrop = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("type") == "crop" if item else False
    `);

    if (!isCrop) {
        logConsole(`❌ ${selectedInventoryKey} is not a valid harvested crop!`);
        return;
    }

    const reqCrop = window.runPython(`quest_tree.current_node.required_crop`);

    if (selectedInventoryKey !== reqCrop) {
        logConsole(`🐸 Frog Prince: "Ribbit! I do not want ${selectedInventoryKey} right now! Bring me ${reqCrop}!"`);
        return;
    }

    // Process quest turn-in safely without complex returns
    const resJson = window.runPython(`
import json

exp_amt = getattr(quest_tree.current_node, 'exp_reward', 100)
coin_amt = getattr(quest_tree.current_node, 'coin_reward', 50)

inventory_hash.consume("${selectedInventoryKey}")

lvl_up = quest_tree.add_exp(exp_amt)
perk_text = getattr(quest_tree.current_node, 'perk', '')

json.dumps({
    "exp": exp_amt,
    "coins": coin_amt,
    "level_up": True if lvl_up else False,
    "perk": perk_text
})
    `);

    if (!resJson) {
        logConsole("❌ An error occurred during Python quest evaluation.");
        return;
    }

    const res = JSON.parse(resJson);

    // Award base quest coins
    userCoins += res.coins;

    if (res.level_up) {
        const currentLvl = window.runPython(`quest_tree.current_node.level`);
        const levelBonus = 200 * currentLvl;
        userCoins += levelBonus;
        
        logConsole(`🎉 LEVEL UP! Frog Prince leveled up! Unlocked: ${res.perk}`);
        logConsole(`🎁 Received Quest Reward (+${res.exp} EXP, +${res.coins} Coins) + LEVEL BONUS (+${levelBonus} Coins)!`);
    } else {
        logConsole(`🐸 Quest Hand-In Successful! Received +${res.exp} EXP & +${res.coins} Coins!`);
    }

    // Clear selection if depleted
    const remCount = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("count", 0) if item else 0
    `);

    if (!remCount || remCount <= 0) {
        selectedInventoryKey = null;
        const indicator = document.getElementById('active-item-indicator');
        if (indicator) indicator.textContent = 'Selected: None';
    }

    renderMinecraftHotbar();
    updateStatsUI();
}

function sellHarvestedCrop() {
    if (!selectedInventoryKey) {
        logConsole("❌ Select a harvested crop from your inventory to sell!");
        return;
    }

    const isCrop = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("type") == "crop" if item else False
    `);

    if (!isCrop) {
        logConsole(`❌ ${selectedInventoryKey} is not a valid crop to sell!`);
        return;
    }

    const sellPrice = window.runPython(`
c_obj = CROP_DATABASE.get("${selectedInventoryKey}")
c_obj.sell_price if c_obj else 30
    `) || 30;

    window.runPython(`inventory_hash.consume("${selectedInventoryKey}")`);
    userCoins += Number(sellPrice);

    logConsole(`💰 Sold 1x ${selectedInventoryKey} to the Frog Prince for +${sellPrice} Coins!`);
    
    const remCount = window.runPython(`
item = inventory_hash.get("${selectedInventoryKey}")
item.get("count", 0) if item else 0
    `);

    if (!remCount || remCount <= 0) {
        selectedInventoryKey = null;
    }

    renderMinecraftHotbar();
    updateStatsUI();
}

function buyFertilizer(cost) {
    if (userCoins < cost) {
        logConsole(`❌ Not enough coins! (Costs ${cost} coins, you have ${userCoins})`);
        return;
    }
    userCoins -= cost;
    window.runPython(`inventory_hash.add("Fertilizer", {"type": "fertilizer", "count": 1, "icon": "🧪", "crop_key": "Fertilizer"})`);
    logConsole(`🛒 Purchased 1x Fertilizer for ${cost} Coins!`);
    updateStatsUI();
    renderMinecraftHotbar();
    closeModal('shop-modal');
}

function buyMysteryBag(tier, cost) {
    if (userCoins < cost) {
        logConsole(`❌ Not enough coins! (Costs ${cost} coins, you have ${userCoins})`);
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
        "fertilized": t.is_fertilized,
        "hp": t.hp,
        "max_hp": t.max_hp,
        "has_crop": t.crop is not None,
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
            if (tile.fertilized) el.classList.add('fertilized');

            let symbol = "";
            if (tile.wilted) {
                symbol = "🥀";
            } else if (tile.symbol) {
                if (tile.stage === 0) symbol = "🌱";
                else if (tile.stage < tile.max_stage) symbol = "🌿";
                else symbol = tile.symbol;
            } else if (tile.tilled) {
                symbol = "";
            }

            let healthBarHtml = "";
            if (tile.has_crop && !tile.wilted) {
                const hpPct = Math.max(0, Math.min(100, Math.floor((tile.hp / tile.max_hp) * 100)));
                const barColor = hpPct > 50 ? '#22c55e' : (hpPct > 20 ? '#eab308' : '#ef4444');
                healthBarHtml = `
                    <div class="crop-hp-bar-bg">
                        <div class="crop-hp-bar-fill" style="width: ${hpPct}%; background-color: ${barColor};"></div>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="tile-header">
                    <span style="font-size: 8px; color: rgba(253,230,138,0.5);">${r},${c}</span>
                    ${tile.fertilized ? '<span class="fertilizer-badge" title="Shielded with Fertilizer">🛡️</span>' : ''}
                </div>
                <span style="font-size: 1.25rem;">${symbol}</span>
                ${healthBarHtml}
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

function openModal(id) {
    if (id === 'shop-modal') {
        renderShopSeasonalCrops();
    }
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function renderShopSeasonalCrops() {
    if (!window.runPython) return;

    // Fetch current season and seasonal crops from Pyodide
    const cropsJson = window.runPython(`
import json

season = climate_queue.get_current_season()

# Filter CROP_DATABASE for crops valid in the active season
seasonal_crops = []
if 'CROP_DATABASE' in globals():
    for name, crop in CROP_DATABASE.items():
        # Check if crop is valid for current season or all-season
        c_season = getattr(crop, 'season', 'Spring')
        if c_season.lower() == season.lower() or c_season.lower() == 'all':
            seasonal_crops.append({
                "name": crop.name,
                "symbol": getattr(crop, 'symbol', '🌱'),
                "days": getattr(crop, 'days_to_grow', 1),
                "rarity": getattr(crop, 'rarity', 'Common').capitalize()
            })

json.dumps({
    "season": season,
    "crops": seasonal_crops
})
    `);

    if (!cropsJson) return;

    try {
        const data = JSON.parse(cropsJson);
        const titleEl = document.getElementById('shop-season-title');
        const listEl = document.getElementById('shop-crop-list');

        if (!titleEl || !listEl) return;

        // Season Icons
        const seasonIcons = {
            'Spring': '🌸',
            'Summer': '☀️',
            'Autumn': '🍂',
            'Fall': '🍂',
            'Winter': '❄️'
        };

        const icon = seasonIcons[data.season] || '🌾';
        titleEl.textContent = `${icon} ${data.season} Crops Available in Seed Bags:`;

        if (data.crops.length === 0) {
            listEl.innerHTML = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 8px;">No specific crops for this season.</div>`;
            return;
        }

        listEl.innerHTML = data.crops.map(crop => {
            const rarityClass = `rarity-${crop.rarity.toLowerCase()}`;
            return `
                <div class="shop-crop-badge">
                    <div class="shop-crop-badge-left">
                        <span style="font-size: 1.1rem;">${crop.symbol}</span>
                        <span>${crop.name}</span>
                    </div>
                    <div class="shop-crop-badge-right">
                        <span>⏳ ${crop.days} Days</span>
                        <span class="${rarityClass}">${crop.rarity}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch(e) {
        console.error("Error rendering shop crop list:", e);
    }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function updateCodeViewer() {
    const selector = document.getElementById('file-selector');
    const viewer = document.getElementById('code-viewer');
    if (selector && viewer && window.pythonModules) {
        viewer.textContent = window.pythonModules[selector.value] || "# Code loading...";
    }
}
window.updateCodeViewer = updateCodeViewer; 