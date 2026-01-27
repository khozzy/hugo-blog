# The Realm of Temporal Analytics

A fantasy-themed dataset for demonstrating Activity Schema temporal join patterns.

## Heroes (5)

| ID | Name | Class | Background |
|----|------|-------|------------|
| hero_001 | Aldric the Swift | Rogue | Former tavern keeper turned dungeon delver |
| hero_002 | Brynn Ironshield | Warrior | Veteran of the Goblin Wars |
| hero_003 | Celeste Moonwhisper | Mage | Exiled court wizard |
| hero_004 | Doran Stoneforge | Paladin | Dwarven temple guardian |
| hero_005 | Elara Nightbloom | Ranger | Tracker from the Whispering Woods |

## Quests (8)

| quest_id | Name | Difficulty | Typical Duration |
|----------|------|------------|------------------|
| quest_goblin | Clear the Goblin Camp | easy | 30-60 min |
| quest_artifact | Retrieve the Lost Artifact | medium | 1-2 hours |
| quest_dragon | Slay the Dragon | legendary | 2-4 hours |
| quest_escort | Escort the Merchant | easy | 20-40 min |
| quest_curse | Lift the Village Curse | medium | 1-3 hours |
| quest_undead | Purge the Undead Crypt | hard | 2-3 hours |
| quest_tower | Climb the Wizard's Tower | hard | 1-2 hours |
| quest_relic | Find the Sacred Relic | legendary | 3-5 hours |

## Items (12)

| item_id | Name | Rarity | Type |
|---------|------|--------|------|
| sword_flame | Flame Sword | rare | weapon |
| bow_eagle | Eagle Eye Bow | rare | weapon |
| staff_storm | Stormcaller Staff | epic | weapon |
| helm_iron | Iron Helm | common | armor |
| ring_health | Ring of Vitality | uncommon | accessory |
| potion_heal | Healing Potion | common | consumable |
| potion_mana | Mana Elixir | common | consumable |
| scroll_fire | Scroll of Fireball | uncommon | consumable |
| amulet_luck | Lucky Amulet | rare | accessory |
| boots_swift | Boots of Swiftness | uncommon | armor |
| shield_oak | Oaken Shield | common | armor |
| gem_power | Power Gem | epic | material |

## Enemies (8)

| Type | Locations | Difficulty |
|------|-----------|------------|
| Goblin | Forest, Camp | easy |
| Skeleton | Crypt, Ruins | easy |
| Orc | Mountains, Fortress | medium |
| Wraith | Crypt, Tower | medium |
| Troll | Swamp, Cave | hard |
| Demon | Tower, Abyss | hard |
| Dragon | Lair, Mountains | legendary |
| Lich | Crypt, Tower | legendary |

## Dungeons (5)

| dungeon_id | Name | Tier | Typical Loot |
|------------|------|------|--------------|
| dungeon_crypt | The Sunken Crypt | 1 | 2-4 items |
| dungeon_cave | Darkfang Cave | 2 | 3-5 items |
| dungeon_tower | The Obsidian Tower | 3 | 4-6 items |
| dungeon_fortress | Iron Fortress | 3 | 5-7 items |
| dungeon_abyss | The Endless Abyss | 4 | 6-10 items |

## Skills (10)

| skill_id | Name | Type | Class |
|----------|------|------|-------|
| skill_slash | Power Slash | combat | Warrior |
| skill_stealth | Shadow Step | utility | Rogue |
| skill_fireball | Fireball | magic | Mage |
| skill_heal | Divine Heal | support | Paladin |
| skill_track | Hunter's Mark | utility | Ranger |
| skill_shield | Shield Wall | defense | Warrior |
| skill_poison | Venomous Strike | combat | Rogue |
| skill_frost | Frost Nova | magic | Mage |
| skill_smite | Holy Smite | combat | Paladin |
| skill_trap | Bear Trap | utility | Ranger |

## Activity Types

| Activity | Description | Key Features |
|----------|-------------|--------------|
| `quest_accepted` | Hero starts a quest | quest_id, quest_name, difficulty |
| `quest_completed` | Hero finishes a quest | quest_id, reward_gold, xp_gained |
| `item_pickup` | Hero collects an item | item_id, item_name, item_rarity |
| `level_up` | Hero gains a level | new_level, class |
| `battle_start` | Combat begins | enemy_type, location |
| `battle_end` | Combat ends | outcome, damage_taken |
| `dungeon_enter` | Hero enters dungeon | dungeon_name, dungeon_tier |
| `dungeon_exit` | Hero leaves dungeon | loot_count, time_spent_minutes |
| `skill_learned` | Hero learns ability | skill_name, skill_type |
| `party_join` | Hero joins a group | party_id, party_size |

## Data Characteristics

- **Time span**: 7 days (2025-06-01 to 2025-06-07)
- **Heroes**: 5 unique adventurers
- **Events**: ~200-300 total activities
- **Concurrency**: Heroes can have multiple active quests, overlapping battles
- **Logical sequencing**: Events follow realistic game logic (e.g., quest_completed only after quest_accepted)
