# python/modules/queue.py
class ClimateQueue:
    """FIFO Queue for seasonal climate transitions and weather cycling."""
    def __init__(self):
        self.seasons = ["Spring", "Summer", "Autumn", "Winter"]
        self.weather_patterns = ["Sunny", "Rainy", "Overcast"]
        self.current_season_idx = 0
        self.current_day = 1

    def get_current_season(self):
        return self.seasons[self.current_season_idx]

    def get_current_weather(self):
        return self.weather_patterns[(self.current_day - 1) % len(self.weather_patterns)]

    def advance_day(self, grid_matrix):
        self.current_day += 1
        
        # Advance season after 30 days and reset current_day to 1
        if self.current_day > 30:
            self.current_day = 1
            self.current_season_idx = (self.current_season_idx + 1) % len(self.seasons)
        
        # Advance crops in matrix grid
        grid_matrix.process_day_transition(self.get_current_season())