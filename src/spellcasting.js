import { utils } from './api'
import { MODULE_ID, getFlag, localize, templatePath, warn, hasKineticActivation } from './module'
import { getSpellcastingEntryStaffData } from './staves'

export async function onSpellcastingEntryCast(wrapped, ...args) {
    const staffData = getSpellcastingEntryStaffData(this)
    if (!staffData) return wrapped(...args)

    const actor = this.actor
    const staff = actor.items.get(staffData.staveID)
    if (!staff?.isEquipped) {
        warn('staves.noStaff')
        return
    }

    const [spell, { level }] = args
    const castRank = spell.computeCastRank(level)

    if (!level || level === '0') {
        return spell.toMessage(undefined, { data: { castLevel: castRank } })
    }

    if (staffData.charges < 1 || (staffData.charges < castRank && staffData.overcharge)) {
        warn('staves.noCharge')
        return
    }

    let updates = []

    if (!staffData.overcharge) {
        const spontaneousEntries = actor.spellcasting.filter(
            entry => entry.isSpontaneous && entry.system.slots[`slot${castRank}`].value
        )

        let useSpontaneous = false

        const entryRankValue = entry => entry.system.slots[`slot${castRank}`].value

        if (spontaneousEntries.length === 1) {
            const entry = spontaneousEntries[0]

            const content = localize('staves.spontaneous.one', {
                rank: utils.spellRankLabel(castRank),
                entry: entry.name,
                remaining: entryRankValue(entry),
            })

            useSpontaneous = await Dialog.confirm({
                title: localize('staves.spontaneous.title'),
                defaultYes: false,
                content: `<div class="pf2e-dailies-spontaneous">${content}</div>`,
            })

            if (useSpontaneous) useSpontaneous = 0
        } else if (spontaneousEntries.length > 1) {
            const entries = spontaneousEntries.map((entry, index) => ({
                index,
                name: entry.name,
                remaining: entryRankValue(entry),
            }))

            const content = await renderTemplate(templatePath('staves-spontaneous.hbs'), {
                entries,
                castRank: utils.spellRankLabel(castRank),
                i18n: (key, { hash }) => localize(`staves.spontaneous.${key}`, hash),
            })

            useSpontaneous = await Dialog.wait({
                title: localize('staves.spontaneous.title'),
                content,
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-check"></i>',
                        label: game.i18n.localize('Yes'),
                        callback: html => html.find('input[name=entry]:checked').val(),
                    },
                    no: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize('No'),
                        callback: () => false,
                    },
                },
                close: () => null,
            })
        }

        if (useSpontaneous === null) {
            return
        } else if (useSpontaneous !== false) {
            const entry = spontaneousEntries[useSpontaneous]
            const current = entry.system.slots[`slot${castRank}`].value

            updates.push({ _id: entry.id, [`system.slots.slot${castRank}.value`]: current - 1 })

            staffData.charges -= 1
        }
    }

    if (!updates.length) {
        if (staffData.charges < castRank) {
            warn('staves.noCharge')
            return
        }

        staffData.charges -= castRank
    }

    updates.push({ _id: this.id, [`flags.${MODULE_ID}.staff`]: staffData })

    await actor.updateEmbeddedDocuments('Item', updates)
    await spell.toMessage(undefined, { data: { castLevel: castRank } })
}

export function getValidSpellcastingList(actor) {
    return actor.spellcasting.regular.filter(
        entry => !entry.flags?.['pf2e-staves'] && !getFlag(entry, 'staff') && entry.system.prepared.value !== 'items'
    )
}

export function getSpellcastingEntryMaxSlotRank(entry) {
    let maxSlot = 0

    const slots = entry.system.slots
    for (const key in slots) {
        const slot = slots[key]
        if (slot.max) maxSlot = Math.max(maxSlot, Number(key.slice(4)))
    }

    return maxSlot
}

export function getPreparedSpells(actor) {
    const spells = []

    const entries = actor.spellcasting.regular.filter(entry => entry.isPrepared)
    for (const entry of entries) {
        for (let rank = 1; rank <= 10; rank++) {
            const data = entry.system.slots[`slot${rank}`]
            if (!data.max) continue

            for (const { id, prepared, expended } of Object.values(data.prepared)) {
                if (prepared === false || expended) continue

                const spell = entry.spells.get(id)
                if (!spell) continue

                spells.push(spell)
            }
        }
    }

    return spells
}

export function getNotExpendedPreparedSpellSlot(spell) {
    if (!spell) return

    const rank = spell.rank
    const entry = spell.spellcasting
    const entries = Object.entries(entry.system.slots[`slot${rank}`].prepared)
    const prepared = entries.find(([_, { id, expended }]) => id === spell.id && expended !== true)
    if (!prepared) return

    return {
        slot: prepared[0],
        rank,
        entry,
    }
}

export function getBestSpellcastingEntry(actor) {
    const entries = getValidSpellcastingList(actor)

    let bestEntry = { mod: 0 }

    for (const { tradition, attribute, statistic, isInnate, rank } of entries) {
        if (isInnate) continue

        const mod = statistic.mod
        if (mod > bestEntry.mod) bestEntry = { tradition, attribute, mod, rank }
    }

    if (hasKineticActivation(actor)) {
        const { mod, rank, slug } = actor.classDCs.kineticist ?? {}
        if (mod > bestEntry.mod) bestEntry = { mod, rank, slug }
    }

    if (bestEntry.mod) return bestEntry
}