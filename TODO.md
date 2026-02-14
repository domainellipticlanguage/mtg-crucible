# MTG Crucible — TODO

## Layouts / Templates

### Done
- [x] Standard (creature, instant, sorcery, enchantment, artifact, vehicle, land)
- [x] Planeswalker (3-ability and 4-ability/tall)
- [x] Saga
- [x] Class
- [x] Battle
- [x] Adventure

### Not Started
- [ ] Split (e.g. Assault // Battery, Turn // Burn, fuse cards)
- [ ] Aftermath (e.g. Appeal // Authority — top half normal, bottom half rotated)
- [ ] Flip (Kamigawa-style — upside-down creature on bottom half)
- [ ] Leveler (e.g. Level Up creatures — not Class, the old Zendikar ones)
- [ ] Prototype (e.g. Phyrexian prototype creatures)
- [ ] Case (e.g. Murders at Karlov Manor case enchantments)
- [ ] Mutate (visual treatment TBD) - todo won't support?
- [ ] Room (Duskmourn rooms — split variant)
- [ ] Token / Emblem - todo remove

## Frame Effects

### Done
- [x] Normal
- [x] Nyx (enchantment creatures)
- [x] Snow
- [x] Devoid
- [x] Miracle (overlay effect) - todo remove

### Not Started (won't do)
- [ ] Showcase frames (set-specific, probably out of scope)
- [ ] Extended art
- [ ] Borderless
- [ ] Etched foil

## Rendering Quality

- [ ] Multi-color adventure frames (gradient blending in the book area)
- [ ] Watermarks (guild symbols, set symbols in rules text background) (won't do)
- [X] Hybrid mana frame treatment
- [ ] Color indicator positioning refinement
- [ ] Better text auto-sizing for edge cases (very long names, many abilities)
- [ ] Flavor text divider bar (the small line between rules and flavor)

## Parser

- [ ] Adventure card parsing from text format (currently only works from structured JSON)
- [ ] Split card parsing from text format
- [ ] Aftermath parsing from text format
- [ ] Leveler ability parsing
- [ ] Prototype ability parsing
- [ ] Case ability parsing (partially done in types, parser has basic support)

## React Component (MtgCard)

- [ ] Flip animation for adventure cards (show adventure side?)
- [ ] Loading states / skeleton
- [ ] Error states

## Infrastructure

- [ ] compare.ts: support all link types (currently only transform + adventure)
- [ ] Snapshot / regression tests for each template
- [ ] CI pipeline
- [ ] npm publish setup
- [ ] Documentation / README
