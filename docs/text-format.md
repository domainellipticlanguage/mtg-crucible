# Text Format Reference

mtg-crucible consumes a compact, spoiler-style text format. This document captures the exact grammar that `parseCard()` implements so contributors can author fixtures confidently.

## File Layout

1. **Name line** — `Name {mana cost}`. The mana cost is optional; when present it must use curly braces around each symbol. Lowercase or phyrexian symbols are normalized automatically (`{g/p}` → `{G/P}`).
2. **Metadata block (optional)** — zero or more lines immediately after the name providing structured metadata. Each line is `Label: Value`. Supported labels are documented below. Unknown labels are ignored, so you can safely annotate drafts without breaking parsing.
3. **Type line** — usually `Supertypes Types — Subtypes`. Multiple supertypes/types are allowed (e.g., `Legendary Enchantment Artifact`). The em dash can be an actual em dash, en dash, or hyphen.
4. **Body** — rules text, structured ability sections, stats, and flavor lines depending on card type.

All blank lines or carriage returns are ignored. Invisible Unicode such as zero-width joiners are stripped before processing.

## Supported Metadata

| Label | Example | Effect |
| --- | --- | --- |
| `Art:` | `Art: https://.../image.png` | Sets `CardData.artUrl` for art fetching |
| `Rarity:` | `Rarity: Mythic Rare` | Case-insensitive; "Mythic Rare" collapses to `mythic` |
| `Artist:` | `Artist: Victor Adame Minguez` | Populates `card.artist` |
| `Set:` | `Set: rix` | Stored uppercased in `card.setCode` |
| `Collector Number:` | `Collector Number: 180` | Stored verbatim in `card.collectorNumber` |
| `Designer:` | `Designer: MTG Team` | Stored in `card.designer` |
| `Color Indicator:` | `Color Indicator: white blue` | Parses into `card.colorIndicator` (supports names or single-letter aliases) |

You can interleave these lines in any order. The parser stops treating lines as metadata once it encounters the type line.

## Rules Body Details

- **Standard cards**: the final `N/N` line becomes power/toughness when the type line includes `Creature` or `Vehicle`. Everything before it is oracle text. Consecutive `*flavor*` lines at the end become flavor text (without the asterisks).
- **Planeswalkers**: lines beginning with `+N:`, `-N:`, or `0:` are loyalty abilities. `Loyalty: N` captures starting loyalty. Lines without a cost prefix are treated as static abilities and retained in order.
- **Sagas**: each chapter line must match `I — ...` (roman numerals `I`–`VI`, optionally combined via commas). The parser records the chapter indices and associated text.
- **Battles**: include a `Defense: N` line anywhere in the body to set defense. Remaining lines become oracle text.
- **Classes**: level headers look like `{cost}: Level N`. Reminder text wrapped in `*(...)*` that appears before the first ability becomes `unstructuredAbilities` (rendered in italics). Each level captures its mana cost (or empty string) plus multiline ability text.

## Flavor & Reminder Text

- Flavor text must be wrapped in single `*asterisks*` and always resides at the end of the card definition.
- Reminder text in the middle of rules (`*(Reminder ... )*`) is preserved as part of oracle text; only trailing flavor paragraphs are stripped.

## Robustness Features

- Windows `CRLF` newlines, smart quotes, and zero-width characters are normalized automatically.
- Mana symbols are uppercased, and whitespace around braces is stripped, so `{t}` or `{ g }` both resolve to `{T}` and `{G}`.
- Unknown metadata labels or stray blank lines are ignored.

Refer back to this document when adding new fixtures or parser behaviors to keep the text format aligned with the code.
