export const savant = [
    "/** @typedef {'first' | 'second' | 'third' | 'fourth'} SavantRow */",
    '/** @typedef {Record<SavantRow, { level: number; condition: boolean }>} SavantCustom */',
    "/** @typedef {[SavantRow, SavantCustom, '']} SavantGenerics */",
    '',
    "const ROWS = /** @type {const} */ (['first', 'second', 'third', 'fourth'])",
    '',
    '/**',
    ' * @param {CharacterPF2e} actor',
    ' * @param {MagicTradition} tradition',
    ' */',
    'function getSpellcastingTraditionDetails(actor, tradition) {',
    '    let maxSlot = 1',
    '    let maxTradition = 0',
    '',
    '    for (const entry of actor.spellcasting.regular) {',
    "        if ('pf2e-staves' in entry.flags) continue // we skip staff entries",
    '',
    '        const slots = entry.system.slots',
    '        for (const key in slots) {',
    '            const slot = slots[key]',
    '            if (slot.max) maxSlot = Math.max(maxSlot, Number(key.slice(4)))',
    '        }',
    '',
    '        if (entry.tradition === tradition) maxTradition = Math.max(maxTradition, entry.rank)',
    '    }',
    '',
    '    return { maxSlot: Math.min(maxSlot, 10), maxTradition }',
    '}',
    '',
    '/** @type {Daily<SavantGenerics>} */',
    'const scrollSavant = {',
    "    key: 'savant',",
    '    item: {',
    "        uuid: 'Compendium.pf2e.feats-srd.Item.u5DBg0LrBUKP0JsJ', // Scroll Savant",
    '    },',
    '    prepare: ({ actor }) => {',
    "        const { maxSlot, maxTradition } = getSpellcastingTraditionDetails(actor, 'arcane')",
    '        return {',
    '            first: { level: maxSlot - 2, condition: true },',
    '            second: { level: maxSlot - 3, condition: true },',
    '            third: { level: maxSlot - 4, condition: maxTradition >= 3 && maxSlot >= 5 },',
    '            fourth: { level: maxSlot - 5, condition: maxTradition >= 4 && maxSlot >= 6 },',
    '        }',
    '    },',
    '    rows: ROWS.map(rowName => {',
    '        /** @type {DailyRowDrop<SavantGenerics>} */',
    '        const row = {',
    "            type: 'drop',",
    '            slug: rowName,',
    '            label: ({ custom }) => `PF2E.SpellLevel${custom[rowName].level}`,',
    '            filter: {',
    "                type: 'spell',",
    '                search: ({ custom }) => ({',
    "                    category: ['spell'],",
    "                    traditions: ['arcane'],",
    '                    level: custom[rowName].level,',
    '                }),',
    '            },',
    '            condition: ({ custom }) => custom[rowName].condition,',
    '        }',
    '        return row',
    '    }),',
    '    process: async ({ utils, fields, custom, addItem, messages }) => {',
    '        for (const field of Object.values(fields)) {',
    '            const uuid = field.uuid',
    '            const source = await utils.createSpellScrollSource({ uuid, level: custom[field.row].level })',
    '            addItem(source)',
    "            messages.add('scrolls', { uuid, label: source.name })",
    '        }',
    '    },',
    '}',
    '',
    'return scrollSavant',
].join('\n')
