# python/modules/paradigms.py
import random

from python.modules.oop_concepts import CROP_DATABASE

def buy_seasonal_mystery_bag(tier, season):
    """Greedy probability roll based on tier level."""
    roll = random.randint(1, 100)
    if tier == 1:
        rarity = "Rare" if roll <= 5 else ("Uncommon" if roll <= 30 else "Common")
    elif tier == 2:
        rarity = "Rare" if roll <= 15 else ("Uncommon" if roll <= 60 else "Common")
    else:
        rarity = "Rare" if roll <= 30 else ("Uncommon" if roll <= 80 else "Common")

    for crop in CROP_DATABASE.values():
        if crop.season == season and crop.rarity == rarity:
            return crop
    return CROP_DATABASE["Turnip"]