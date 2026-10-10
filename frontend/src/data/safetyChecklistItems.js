/**
 * Simplified 15 Core Workplace Safety Issues for frontline reporting.
 * Kept concise and easily understandable for workers with limited literacy.
 */

export const ALL_CHECKLIST_ITEMS = [
  {
    id: 'issue_gas_leak',
    label: 'Gas Leak',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['gas', 'leak', 'fume', 'vapor', 'vapour', 'odor', 'smell', 'methane', 'h2s', 'flammable']
  },
  {
    id: 'issue_oil_spill',
    label: 'Oil Spill',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['oil', 'spill', 'diesel', 'fuel', 'crude', 'lubricant', 'slick']
  },
  {
    id: 'issue_chemical_spill',
    label: 'Chemical Spill',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['chemical', 'spill', 'acid', 'caustic', 'solvent', 'toxic', 'liquid']
  },
  {
    id: 'issue_fire_smoke',
    label: 'Fire or Smoke',
    category: 'NEAR_MISS',
    categoryLabel: 'Near Miss',
    badgeClass: 'bg-orange-100 text-[#FF5A36] border-orange-200',
    keywords: ['fire', 'smoke', 'flame', 'spark', 'burn', 'combustion', 'blaze', 'ignit']
  },
  {
    id: 'issue_broken_machine',
    label: 'Broken Machine',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['broken', 'machine', 'machinery', 'equipment', 'faulty', 'malfunction', 'motor', 'pump']
  },
  {
    id: 'issue_exposed_electric_wires',
    label: 'Exposed Electric Wires',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['wire', 'electric', 'electrical', 'cable', 'exposed', 'bare', 'shock', 'voltage']
  },
  {
    id: 'issue_slippery_floor',
    label: 'Slippery Floor',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['slippery', 'floor', 'slip', 'wet', 'slick', 'grease', 'trip']
  },
  {
    id: 'issue_broken_ladder_platform',
    label: 'Broken Ladder or Platform',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['ladder', 'platform', 'broken', 'scaffold', 'rung', 'step', 'handrail', 'plank']
  },
  {
    id: 'issue_missing_safety_gear',
    label: 'Missing Safety Gear',
    category: 'UNSAFE_ACT',
    categoryLabel: 'Unsafe Act',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    keywords: ['ppe', 'gear', 'helmet', 'gloves', 'goggle', 'glasses', 'harness', 'vest', 'safety gear', 'missing']
  },
  {
    id: 'issue_uncovered_pit_hole',
    label: 'Uncovered Pit or Hole',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['pit', 'hole', 'uncovered', 'opening', 'trench', 'grating', 'fall', 'manhole']
  },
  {
    id: 'issue_falling_objects',
    label: 'Falling Objects',
    category: 'NEAR_MISS',
    categoryLabel: 'Near Miss',
    badgeClass: 'bg-orange-100 text-[#FF5A36] border-orange-200',
    keywords: ['falling', 'dropped', 'object', 'overhead', 'tool', 'load', 'debris']
  },
  {
    id: 'issue_blocked_emergency_exit',
    label: 'Blocked Emergency Exit',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['blocked', 'emergency', 'exit', 'door', 'egress', 'obstructed', 'aisle']
  },
  {
    id: 'issue_unsafe_chemical_storage',
    label: 'Unsafe Chemical Storage',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['chemical', 'storage', 'drum', 'container', 'unsafe', 'barrel', 'unsealed', 'hazardous']
  },
  {
    id: 'issue_heavy_load_falling',
    label: 'Heavy Load Falling',
    category: 'NEAR_MISS',
    categoryLabel: 'Near Miss',
    badgeClass: 'bg-orange-100 text-[#FF5A36] border-orange-200',
    keywords: ['heavy', 'load', 'falling', 'crane', 'suspended', 'rigging', 'hoist', 'sling']
  },
  {
    id: 'issue_broken_fire_extinguisher',
    label: 'Broken Fire Extinguisher',
    category: 'UNSAFE_CONDITION',
    categoryLabel: 'Unsafe Condition',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    keywords: ['fire extinguisher', 'extinguisher', 'broken', 'damaged', 'empty', 'depleted', 'unserviceable']
  }
];

export const CLASSIFICATION_CHECKLISTS = {
  NEAR_MISS: ALL_CHECKLIST_ITEMS.filter((item) => item.category === 'NEAR_MISS'),
  UNSAFE_ACT: ALL_CHECKLIST_ITEMS.filter((item) => item.category === 'UNSAFE_ACT'),
  UNSAFE_CONDITION: ALL_CHECKLIST_ITEMS.filter((item) => item.category === 'UNSAFE_CONDITION')
};
