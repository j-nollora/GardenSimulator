# python/modules/hierarchical_tree.py
class QuestNode:
    def __init__(self, level, title, required_crop, perk):
        self.level = level
        self.title = title
        self.required_crop = required_crop
        self.perk = perk
        self.next_node = None


class QuestProgressionTree:
    """Hierarchical N-ary / Linked Tree for quest progression and tool perks."""
    def __init__(self):
        n1 = QuestNode(1, "Frog Prince (Fallen King)", "Turnip", "1x1 Single Tile")
        n2 = QuestNode(2, "Noble Frog", "Strawberry", "2x2 AOE Tools")
        n3 = QuestNode(3, "Royal Frog Monarch", "Pumpkin", "3x3 Master AOE Tools")
        n4 = QuestNode(4, "Human Prince Restored", "None", "Victory State")
        
        n1.next_node = n2
        n2.next_node = n3
        n3.next_node = n4
        
        self.current_node = n1

    def advance_quest(self):
        if self.current_node.next_node:
            self.current_node = self.current_node.next_node
            return True
        return False

    def get_aoe_range(self):
        return 1 if self.current_node.level == 1 else (2 if self.current_node.level == 2 else 3)

    def get_current_quest_desc(self):
        if self.current_node.level == 4:
            return "Curse Lifted! You Restored the Kingdom!"
        return f"Bring me 1x {self.current_node.required_crop} to unlock {self.current_node.next_node.perk}!"