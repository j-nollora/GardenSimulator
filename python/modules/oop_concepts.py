# python/modules/oop_concepts.py
class Crop:
    def __init__(self, name, symbol, season, days_to_grow, rarity="Common"):
        self.name = name
        self.symbol = symbol
        self.season = season
        self.days_to_grow = days_to_grow
        self.rarity = rarity

CROP_DATABASE = {
    "Turnip": Crop("Turnip", "🧅", "Spring", 1, "Common"),
    "Strawberry": Crop("Strawberry", "🍓", "Spring", 2, "Rare"),
    "Corn": Crop("Corn", "🌽", "Summer", 2, "Common"),
    "Pumpkin": Crop("Pumpkin", "🎃", "Fall", 3, "Uncommon"),
    "Frost Lily": Crop("Frost Lily", "🪷", "Winter", 2, "Rare")
}