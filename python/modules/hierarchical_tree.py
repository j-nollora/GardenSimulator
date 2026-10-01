# python/modules/hierarchical_tree.py
class QuestNode:
    def __init__(self, level, title, required_crop, perk):
        self.level = level
        self.title = title
        self.required_crop = required_crop
        self.perk = perk
        self.next_node = None


class QuestProgressionTree:
    """Hierarchical Tree for Frog EXP, levels, and gradual tool upgrades."""
    def __init__(self):
        n1 = QuestNode(1, "Frog Prince (Fallen King)", "Turnip", "Standard 5L Water Bucket")
        n2 = QuestNode(2, "Noble Frog", "Strawberry", "Expanded 10L Water Bucket")
        n3 = QuestNode(3, "Royal Frog Monarch", "Pumpkin", "2x2 AOE Area Tools")
        n4 = QuestNode(4, "Human King Restored", "None", "3x3 Master AOE Tools")
        
        n1.next_node = n2
        n2.next_node = n3
        n3.next_node = n4
        
        self.current_node = n1
        self.current_exp = 0
        self.exp_to_next_level = 50

    def add_exp(self, amount):
        self.current_exp += amount
        if self.current_exp >= self.exp_to_next_level and self.current_node.next_node:
            self.current_exp -= self.exp_to_next_level
            self.exp_to_next_level += 25
            self.current_node = self.current_node.next_node
            return True
        return False

    def get_max_bucket(self):
        return 10 if self.current_node.level >= 2 else 5

    def get_aoe_range(self):
        if self.current_node.level < 3:
            return 1
        elif self.current_node.level == 3:
            return 2
        else:
            return 3

    def get_current_quest_desc(self):
        if self.current_node.level == 4:
            return "Curse Lifted! Kingdom Restored!"
        return f"Bring me 1x {self.current_node.required_crop} for +25 EXP!"