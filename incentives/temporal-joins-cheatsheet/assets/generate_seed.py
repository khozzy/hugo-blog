#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Generate fantasy realm event data for Activity Schema demo.

Creates a seed.sql file with ~200-300 events across 5 heroes over 7 days,
demonstrating all temporal join patterns with concurrent activities.

Usage:
    uv run generate_seed.py
    # or
    chmod +x generate_seed.py && ./generate_seed.py
"""

import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

# Seed for reproducibility
random.seed(42)

# === FANTASY REALM CONSTANTS ===

HEROES = [
    {"id": "hero_001", "name": "Aldric the Swift", "class": "Rogue"},
    {"id": "hero_002", "name": "Brynn Ironshield", "class": "Warrior"},
    {"id": "hero_003", "name": "Celeste Moonwhisper", "class": "Mage"},
    {"id": "hero_004", "name": "Doran Stoneforge", "class": "Paladin"},
    {"id": "hero_005", "name": "Elara Nightbloom", "class": "Ranger"},
]

QUESTS = [
    {"id": "quest_goblin", "name": "Clear the Goblin Camp", "difficulty": "easy", "duration_min": 30, "duration_max": 60, "reward_gold": (50, 100), "xp": (100, 200)},
    {"id": "quest_artifact", "name": "Retrieve the Lost Artifact", "difficulty": "medium", "duration_min": 60, "duration_max": 120, "reward_gold": (150, 300), "xp": (300, 500)},
    {"id": "quest_dragon", "name": "Slay the Dragon", "difficulty": "legendary", "duration_min": 120, "duration_max": 240, "reward_gold": (1000, 2000), "xp": (2000, 3000)},
    {"id": "quest_escort", "name": "Escort the Merchant", "difficulty": "easy", "duration_min": 20, "duration_max": 40, "reward_gold": (30, 80), "xp": (80, 150)},
    {"id": "quest_curse", "name": "Lift the Village Curse", "difficulty": "medium", "duration_min": 60, "duration_max": 180, "reward_gold": (200, 400), "xp": (400, 700)},
    {"id": "quest_undead", "name": "Purge the Undead Crypt", "difficulty": "hard", "duration_min": 120, "duration_max": 180, "reward_gold": (400, 700), "xp": (800, 1200)},
    {"id": "quest_tower", "name": "Climb the Wizard's Tower", "difficulty": "hard", "duration_min": 60, "duration_max": 120, "reward_gold": (350, 600), "xp": (700, 1000)},
    {"id": "quest_relic", "name": "Find the Sacred Relic", "difficulty": "legendary", "duration_min": 180, "duration_max": 300, "reward_gold": (800, 1500), "xp": (1500, 2500)},
]

ITEMS = [
    {"id": "sword_flame", "name": "Flame Sword", "rarity": "rare", "type": "weapon"},
    {"id": "bow_eagle", "name": "Eagle Eye Bow", "rarity": "rare", "type": "weapon"},
    {"id": "staff_storm", "name": "Stormcaller Staff", "rarity": "epic", "type": "weapon"},
    {"id": "helm_iron", "name": "Iron Helm", "rarity": "common", "type": "armor"},
    {"id": "ring_health", "name": "Ring of Vitality", "rarity": "uncommon", "type": "accessory"},
    {"id": "potion_heal", "name": "Healing Potion", "rarity": "common", "type": "consumable"},
    {"id": "potion_mana", "name": "Mana Elixir", "rarity": "common", "type": "consumable"},
    {"id": "scroll_fire", "name": "Scroll of Fireball", "rarity": "uncommon", "type": "consumable"},
    {"id": "amulet_luck", "name": "Lucky Amulet", "rarity": "rare", "type": "accessory"},
    {"id": "boots_swift", "name": "Boots of Swiftness", "rarity": "uncommon", "type": "armor"},
    {"id": "shield_oak", "name": "Oaken Shield", "rarity": "common", "type": "armor"},
    {"id": "gem_power", "name": "Power Gem", "rarity": "epic", "type": "material"},
]

ENEMIES = [
    {"type": "Goblin", "locations": ["Forest", "Camp"], "difficulty": "easy"},
    {"type": "Skeleton", "locations": ["Crypt", "Ruins"], "difficulty": "easy"},
    {"type": "Orc", "locations": ["Mountains", "Fortress"], "difficulty": "medium"},
    {"type": "Wraith", "locations": ["Crypt", "Tower"], "difficulty": "medium"},
    {"type": "Troll", "locations": ["Swamp", "Cave"], "difficulty": "hard"},
    {"type": "Demon", "locations": ["Tower", "Abyss"], "difficulty": "hard"},
    {"type": "Dragon", "locations": ["Lair", "Mountains"], "difficulty": "legendary"},
    {"type": "Lich", "locations": ["Crypt", "Tower"], "difficulty": "legendary"},
]

DUNGEONS = [
    {"id": "dungeon_crypt", "name": "The Sunken Crypt", "tier": 1, "loot_min": 2, "loot_max": 4},
    {"id": "dungeon_cave", "name": "Darkfang Cave", "tier": 2, "loot_min": 3, "loot_max": 5},
    {"id": "dungeon_tower", "name": "The Obsidian Tower", "tier": 3, "loot_min": 4, "loot_max": 6},
    {"id": "dungeon_fortress", "name": "Iron Fortress", "tier": 3, "loot_min": 5, "loot_max": 7},
    {"id": "dungeon_abyss", "name": "The Endless Abyss", "tier": 4, "loot_min": 6, "loot_max": 10},
]

SKILLS = [
    {"id": "skill_slash", "name": "Power Slash", "type": "combat", "class": "Warrior"},
    {"id": "skill_stealth", "name": "Shadow Step", "type": "utility", "class": "Rogue"},
    {"id": "skill_fireball", "name": "Fireball", "type": "magic", "class": "Mage"},
    {"id": "skill_heal", "name": "Divine Heal", "type": "support", "class": "Paladin"},
    {"id": "skill_track", "name": "Hunter's Mark", "type": "utility", "class": "Ranger"},
    {"id": "skill_shield", "name": "Shield Wall", "type": "defense", "class": "Warrior"},
    {"id": "skill_poison", "name": "Venomous Strike", "type": "combat", "class": "Rogue"},
    {"id": "skill_frost", "name": "Frost Nova", "type": "magic", "class": "Mage"},
    {"id": "skill_smite", "name": "Holy Smite", "type": "combat", "class": "Paladin"},
    {"id": "skill_trap", "name": "Bear Trap", "type": "utility", "class": "Ranger"},
]

# Time range
START_DATE = datetime(2025, 6, 1, 6, 0, 0)  # Start at 6 AM
END_DATE = datetime(2025, 6, 7, 23, 59, 59)


@dataclass
class Event:
    ts: datetime
    activity: str
    entity: str
    features: dict

    def to_sql(self) -> str:
        ts_str = self.ts.strftime("%Y-%m-%d %H:%M:%S")
        features_json = json.dumps(self.features, separators=(",", ":"))
        # Escape single quotes in JSON
        features_json = features_json.replace("'", "''")
        return f"('{ts_str}', '{self.activity}', '{self.entity}', '{features_json}')"


@dataclass
class HeroState:
    hero: dict
    current_time: datetime
    level: int = 1
    active_quests: dict = field(default_factory=dict)  # quest_id -> start_time
    in_dungeon: dict | None = None  # dungeon info + enter_time
    in_battle: dict | None = None  # battle info + start_time
    party_id: str | None = None
    learned_skills: set = field(default_factory=set)
    events: list = field(default_factory=list)

    def add_event(self, activity: str, features: dict, time_offset_minutes: int = 0):
        self.current_time += timedelta(minutes=time_offset_minutes)
        self.events.append(Event(
            ts=self.current_time,
            activity=activity,
            entity=self.hero["id"],
            features=features
        ))


def generate_hero_journey(hero: dict) -> list[Event]:
    """Generate a realistic sequence of events for a single hero."""
    state = HeroState(
        hero=hero,
        current_time=START_DATE + timedelta(hours=random.randint(0, 4)),
        level=random.randint(1, 3),
    )

    # Track available quests (remove completed ones)
    available_quests = QUESTS.copy()

    # Target ~50-60 events per hero (250-300 total)
    max_events_per_hero = 60

    while state.current_time < END_DATE and len(state.events) < max_events_per_hero:
        # Determine what actions are possible
        actions = []

        # Can always pick up items (if not in battle)
        if not state.in_battle:
            actions.append("item_pickup")

        # Can start a new quest if not maxed out (max 2 concurrent)
        if len(state.active_quests) < 2 and available_quests and not state.in_battle:
            actions.append("quest_accepted")

        # Can complete quest if one is ready
        ready_quests = [
            qid for qid, start in state.active_quests.items()
            if (state.current_time - start).total_seconds() / 60 >= 20
        ]
        if ready_quests:
            actions.append("quest_completed")

        # Can enter dungeon if not already in one and not in battle
        if not state.in_dungeon and not state.in_battle:
            actions.append("dungeon_enter")

        # Can exit dungeon if in one
        if state.in_dungeon:
            time_in = (state.current_time - state.in_dungeon["enter_time"]).total_seconds() / 60
            if time_in >= 15:
                actions.append("dungeon_exit")

        # Can start battle if not in one
        if not state.in_battle:
            actions.append("battle_start")

        # Can end battle if in one
        if state.in_battle:
            time_in = (state.current_time - state.in_battle["start_time"]).total_seconds() / 60
            if time_in >= 2:
                actions.append("battle_end")

        # Can level up occasionally
        if random.random() < 0.05:
            actions.append("level_up")

        # Can learn skill if leveled up enough
        hero_skills = [s for s in SKILLS if s["class"] == hero["class"]]
        unlearned = [s for s in hero_skills if s["id"] not in state.learned_skills]
        if unlearned and state.level >= 2 and random.random() < 0.1:
            actions.append("skill_learned")

        # Can join party occasionally
        if not state.party_id and random.random() < 0.03:
            actions.append("party_join")

        if not actions:
            state.current_time += timedelta(minutes=random.randint(5, 15))
            continue

        # Weight actions based on game logic
        weights = {
            "quest_accepted": 3 if len(state.active_quests) == 0 else 1,
            "quest_completed": 5 if ready_quests else 0,
            "item_pickup": 2,
            "level_up": 1,
            "battle_start": 4 if state.in_dungeon else 2,
            "battle_end": 8 if state.in_battle else 0,
            "dungeon_enter": 2,
            "dungeon_exit": 4 if state.in_dungeon else 0,
            "skill_learned": 1,
            "party_join": 1,
        }

        action_weights = [weights.get(a, 1) for a in actions]
        action = random.choices(actions, weights=action_weights, k=1)[0]

        # Execute action
        if action == "quest_accepted":
            quest = random.choice(available_quests)
            state.active_quests[quest["id"]] = state.current_time
            state.add_event("quest_accepted", {
                "quest_id": quest["id"],
                "quest_name": quest["name"],
                "difficulty": quest["difficulty"],
            }, time_offset_minutes=random.randint(1, 10))

        elif action == "quest_completed":
            quest_id = random.choice(ready_quests)
            quest = next(q for q in QUESTS if q["id"] == quest_id)
            del state.active_quests[quest_id]
            # Remove from available to add variety
            if quest in available_quests and len(available_quests) > 2:
                available_quests.remove(quest)
            state.add_event("quest_completed", {
                "quest_id": quest["id"],
                "reward_gold": random.randint(*quest["reward_gold"]),
                "xp_gained": random.randint(*quest["xp"]),
            }, time_offset_minutes=random.randint(5, 30))

        elif action == "item_pickup":
            item = random.choice(ITEMS)
            state.add_event("item_pickup", {
                "item_id": item["id"],
                "item_name": item["name"],
                "item_rarity": item["rarity"],
            }, time_offset_minutes=random.randint(1, 5))

        elif action == "level_up":
            state.level += 1
            state.add_event("level_up", {
                "new_level": state.level,
                "class": hero["class"],
            }, time_offset_minutes=random.randint(1, 3))

        elif action == "battle_start":
            # Choose enemy based on dungeon tier or random
            if state.in_dungeon:
                tier = state.in_dungeon["tier"]
                suitable = [e for e in ENEMIES if
                    (tier <= 1 and e["difficulty"] == "easy") or
                    (tier == 2 and e["difficulty"] in ["easy", "medium"]) or
                    (tier == 3 and e["difficulty"] in ["medium", "hard"]) or
                    (tier >= 4 and e["difficulty"] in ["hard", "legendary"])]
                enemy = random.choice(suitable) if suitable else random.choice(ENEMIES)
            else:
                enemy = random.choice([e for e in ENEMIES if e["difficulty"] in ["easy", "medium"]])
            location = random.choice(enemy["locations"])
            state.in_battle = {"enemy": enemy, "location": location, "start_time": state.current_time}
            state.add_event("battle_start", {
                "enemy_type": enemy["type"],
                "location": location,
            }, time_offset_minutes=random.randint(1, 5))

        elif action == "battle_end":
            outcomes = ["victory", "victory", "victory", "victory", "retreat"]  # 80% win
            outcome = random.choice(outcomes)
            damage = random.randint(5, 50) if outcome == "victory" else random.randint(30, 80)
            state.add_event("battle_end", {
                "outcome": outcome,
                "damage_taken": damage,
            }, time_offset_minutes=random.randint(2, 8))
            state.in_battle = None

        elif action == "dungeon_enter":
            dungeon = random.choice(DUNGEONS)
            state.in_dungeon = {**dungeon, "enter_time": state.current_time}
            state.add_event("dungeon_enter", {
                "dungeon_name": dungeon["name"],
                "dungeon_tier": dungeon["tier"],
            }, time_offset_minutes=random.randint(5, 20))

        elif action == "dungeon_exit":
            time_spent = int((state.current_time - state.in_dungeon["enter_time"]).total_seconds() / 60)
            loot = random.randint(state.in_dungeon["loot_min"], state.in_dungeon["loot_max"])
            state.add_event("dungeon_exit", {
                "loot_count": loot,
                "time_spent_minutes": time_spent,
            }, time_offset_minutes=random.randint(2, 10))
            state.in_dungeon = None

        elif action == "skill_learned":
            skill = random.choice(unlearned)
            state.learned_skills.add(skill["id"])
            state.add_event("skill_learned", {
                "skill_name": skill["name"],
                "skill_type": skill["type"],
            }, time_offset_minutes=random.randint(1, 3))

        elif action == "party_join":
            party_id = f"party_{random.randint(100, 999)}"
            state.party_id = party_id
            state.add_event("party_join", {
                "party_id": party_id,
                "party_size": random.randint(2, 5),
            }, time_offset_minutes=random.randint(5, 15))

        # Random time progression
        state.current_time += timedelta(minutes=random.randint(5, 30))

        # Day/night cycle - heroes rest at night (less activity)
        if state.current_time.hour >= 23 or state.current_time.hour < 6:
            state.current_time += timedelta(hours=random.randint(4, 8))

    return state.events


def generate_all_events() -> list[Event]:
    """Generate events for all heroes."""
    all_events = []
    for hero in HEROES:
        events = generate_hero_journey(hero)
        all_events.extend(events)
        print(f"Generated {len(events)} events for {hero['name']}")

    # Sort by timestamp
    all_events.sort(key=lambda e: e.ts)
    return all_events


def write_sql(events: list[Event], output_path: Path):
    """Write events to SQL seed file."""
    with open(output_path, "w") as f:
        f.write("-- Fantasy Realm Activity Stream\n")
        f.write("-- Generated for Activity Schema temporal join demos\n")
        f.write(f"-- Total events: {len(events)}\n")
        f.write(f"-- Date range: {events[0].ts.date()} to {events[-1].ts.date()}\n")
        f.write("-- Heroes: " + ", ".join(h["name"] for h in HEROES) + "\n")
        f.write("\n")

        f.write("CREATE TABLE IF NOT EXISTS activity_stream (\n")
        f.write("    ts TIMESTAMP,\n")
        f.write("    activity VARCHAR,\n")
        f.write("    entity VARCHAR,\n")
        f.write("    features JSON\n")
        f.write(");\n\n")

        f.write("INSERT INTO activity_stream VALUES\n")

        # Write events in batches for readability
        for i, event in enumerate(events):
            suffix = "," if i < len(events) - 1 else ";"
            f.write(f"    {event.to_sql()}{suffix}\n")

    print(f"\nWritten {len(events)} events to {output_path}")


def main():
    print("Generating Fantasy Realm event data...")
    print("=" * 50)

    events = generate_all_events()

    print("=" * 50)
    print(f"Total events: {len(events)}")

    # Activity breakdown
    activity_counts = {}
    for e in events:
        activity_counts[e.activity] = activity_counts.get(e.activity, 0) + 1

    print("\nActivity breakdown:")
    for activity, count in sorted(activity_counts.items(), key=lambda x: -x[1]):
        print(f"  {activity}: {count}")

    # Write output
    output_path = Path(__file__).parent / "seed.sql"
    write_sql(events, output_path)


if __name__ == "__main__":
    main()
