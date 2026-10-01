# python/modules/matrix_grid.py
import random

class SoilTile:
    def __init__(self, r, c):
        self.r = r
        self.c = c
        self.is_tilled = False
        self.is_watered = False
        self.is_wilted = False
        self.is_fertilized = False
        self.hp = 100
        self.max_hp = 100
        self.crop = None
        self.growth_stage = 0

    def till(self):
        if not self.is_tilled:
            self.is_tilled = True
            return True
        return False

    def water(self):
        if self.is_tilled and not self.is_watered:
            self.is_watered = True
            return True
        return False

    def plant(self, crop):
        if self.is_tilled and not self.crop:
            self.crop = crop
            self.growth_stage = 0
            self.is_wilted = False
            self.is_fertilized = False
            self.hp = 100
            self.max_hp = 100
            return True
        return False


class SoilMatrixGrid:
    def __init__(self, rows=5, cols=5):
        self.rows = rows
        self.cols = cols
        self.grid = [[SoilTile(r, c) for c in range(cols)] for r in range(rows)]
        self.bucket_level = 5
        self.disaster_occurred = False
        self.last_disaster_name = None

    def get_tile(self, r, c):
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return self.grid[r][c]
        return None

    def till_soil(self, r, c):
        tile = self.get_tile(r, c)
        return tile.till() if tile else False

    def water_soil(self, r, c):
        if self.bucket_level <= 0:
            return False
        tile = self.get_tile(r, c)
        if tile and tile.water():
            self.bucket_level -= 1
            return True
        return False

    def plant_seed(self, r, c, crop):
        tile = self.get_tile(r, c)
        return tile.plant(crop) if tile else False

    def apply_fertilizer(self, r, c):
        tile = self.get_tile(r, c)
        # Fertilizer ONLY applies a shield/health recovery; DOES NOT grow the plant immediately
        if tile and tile.crop and not tile.is_wilted and not tile.is_fertilized:
            tile.is_fertilized = True
            tile.hp = tile.max_hp
            return True
        return False

    def harvest_crop(self, r, c):
        tile = self.get_tile(r, c)
        if tile and tile.crop and not tile.is_wilted and tile.growth_stage >= tile.crop.days_to_grow:
            harvested_crop = tile.crop
            tile.crop = None
            tile.growth_stage = 0
            tile.is_watered = False
            tile.is_fertilized = False
            tile.hp = 100
            return harvested_crop
        return None

    def process_day_transition(self, current_season):
        self.disaster_occurred = False
        self.last_disaster_name = None

        disasters = ["Locust Swarm", "Night Frost Blight", "Acid Rainstorm", "Gnome Invasion"]
        disaster_strikes = random.random() < 0.35

        if disaster_strikes:
            self.disaster_occurred = True
            self.last_disaster_name = random.choice(disasters)

        for r in range(self.rows):
            for c in range(self.cols):
                tile = self.grid[r][c]
                if tile.crop:
                    # 1. Season Compatibility Check
                    if tile.crop.season != current_season:
                        tile.is_wilted = True
                    # 2. Watering Requirement: MUST be watered to progress growth; otherwise WILT
                    elif not tile.is_watered:
                        tile.is_wilted = True
                    else:
                        tile.growth_stage += 1

                    # 3. Overnight Disaster Handling
                    if self.disaster_occurred and not tile.is_wilted:
                        damage = random.randint(40, 70)
                        if tile.is_fertilized:
                            damage = max(0, damage - 50)
                            tile.is_fertilized = False  # Fertilizer shield consumed
                        
                        tile.hp -= damage
                        if tile.hp <= 0:
                            tile.hp = 0
                            tile.is_wilted = True

                tile.is_watered = False