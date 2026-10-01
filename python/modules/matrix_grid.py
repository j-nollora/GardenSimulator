# python/modules/matrix_grid.py
class SoilTile:
    def __init__(self, r, c):
        self.r = r
        self.c = c
        self.is_tilled = False
        self.is_watered = False
        self.is_wilted = False
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
            return True
        return False


class SoilMatrixGrid:
    def __init__(self, rows=5, cols=5):
        self.rows = rows
        self.cols = cols
        self.grid = [[SoilTile(r, c) for c in range(cols)] for r in range(rows)]
        self.bucket_level = 5

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
        if tile and tile.crop and tile.growth_stage < tile.crop.days_to_grow:
            tile.growth_stage += 1
            return True
        return False

    def harvest_crop(self, r, c):
        tile = self.get_tile(r, c)
        if tile and tile.crop and not tile.is_wilted and tile.growth_stage >= tile.crop.days_to_grow:
            c_obj = tile.crop
            tile.crop = None
            tile.growth_stage = 0
            tile.is_watered = False
            return c_obj
        return None

    def process_day_transition(self, current_season):
        for r in range(self.rows):
            for c in range(self.cols):
                tile = self.grid[r][c]
                if tile.crop:
                    # Check season compatibility
                    if tile.crop.season != current_season:
                        tile.is_wilted = True
                    elif tile.is_watered and not tile.is_wilted:
                        tile.growth_stage += 1
                tile.is_watered = False