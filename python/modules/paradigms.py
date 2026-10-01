# python/modules/paradigms.py
import random

def buy_seasonal_mystery_bag(tier, season):
    """Greedy selection of seasonal crops from CROP_DATABASE based on tier rolls."""
    roll = random.randint(1, 100)
    
    if tier == 1:
        rarity = "Rare" if roll <= 5 else ("Uncommon" if roll <= 30 else "Common")
    elif tier == 2:
        rarity = "Rare" if roll <= 15 else ("Uncommon" if roll <= 60 else "Common")
    else:  # Tier 3
        rarity = "Rare" if roll <= 30 else ("Uncommon" if roll <= 80 else "Common")

    # 1. Try to find crops matching both Season AND Rarity
    matching_crops = [
        crop for crop in CROP_DATABASE.values() 
        if crop.season == season and crop.rarity == rarity
    ]
    if matching_crops:
        return random.choice(matching_crops)
        
    # 2. Fallback: Any crop from the current season
    fallback_season_crops = [
        crop for crop in CROP_DATABASE.values() 
        if crop.season == season
    ]
    if fallback_season_crops:
        return random.choice(fallback_season_crops)
        
    # 3. Default fallback guarantee (never return None/null)
    return CROP_DATABASE.get("Turnip")