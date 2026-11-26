# Workshop library

Everything a visitor reads on myclaudelab.com comes from the JSON files in this folder. The page loads them when it opens, so adding or changing content needs no code change.

| File | Holds |
| --- | --- |
| `stations.json` | The 13 benches on three arcs: name, promise, 4D focus, what-is-it text, shop rule, "now question it" card, Academy links, source, and the hotspot position on the hall photo |
| `challenges.json` | Spark, Build and Invent challenges for every bench: brief, copy-ready prompt, done-when checks, three hints |
| `selfchecks.json` | The on-site self-check at every bench: three multiple-choice questions with explanations |
| `paths.json` | The Maker Ladder (Visitor to Master Maker), Tool Belt Check, Tool Cage rules and the four explorer's paths |
| `director.json` | The Lab Director's current clips (four key benches) and an archive. Clips stay private in HeyGen. Never store a play link (`src`) here: this repository is public, and the site gets fresh links from `/api/director` |
| `captions/` | WebVTT captions for every Director clip |
| `whatsnew.json` | The chalkboard on the Director's Desk for the current week |
| `lessons.json` | Card catalog lessons |
| `recipes.json` | Recipe box cards |
| `flashcards.json` | Flash cards for spaced review |
| `videos.json` | Replay Theater videos from the YouTube Tip Treasure Chest, plus Academy shelf links |

## Bench ids

Arc 1, Hand Tools: `prompts`, `models`, `discernment`. Arc 2, Power Tools: `artifacts` (with sub-benches `designs`, `data`, `motion`), `projects`, `connectors`. Arc 3, Shop Automation: `skills`, `claudemd`, `mods`, `duet`. Keep ids stable; everything points at them.

## Adding entries

Append new entries to the end of each list. The page sorts lessons and recipes newest first by `date` and marks anything from the last seven days as new.

- Lesson fields: `id` (date plus a slug, unique), `date` (YYYY-MM-DD), `station`, `title`, `body` (one plain paragraph), `tryIt` (optional, one small exercise), `source` (`title` and `url`).
- Recipe fields: `id`, `date`, `station`, `title`, `ingredients` (short list), `method` (the prompt itself, with [brackets] for the parts to fill in), `notes`, `source`.
- Flash card fields: `id` (station-N, unique), `station`, `front`, `back` (plain text; `<code>`, `<br>`, `<b>` and `<i>` allowed).
- Chalkboard items: `date`, `title` (short, it's written in chalk), `body`, `station` (or null), `link` (`#/bench/<id>`, `#recipes`, `#catalog`, or an official https page).

## House rules

- Write for a curious family of adults: plain words, one idea per entry, no jargon without a quick explanation.
- Only describe features that really exist, and check them on the source page first.
- Every `source.url` is an official Anthropic page you actually read: support.claude.com, docs.claude.com, platform.claude.com, code.claude.com, claude.com, anthropic.com or academy.claude.com.
- No repeats: check the existing titles and sources before adding a topic.
- Videos link one specific video page, never a search page.
- Model names, plan availability and new features change often. When you touch an entry about them, re-check it and update `checked` on the bench.
