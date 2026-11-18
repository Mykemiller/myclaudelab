# Workshop library

These two files are the lessons and recipe cards that **every visitor** to myclaudelab.com sees. The page loads them when it opens, so adding an entry needs no code change.

- `lessons.json` fills lesson drawers in the card catalog and the matching station bench.
- `recipes.json` fills workshop cards at the front of the recipe box.

## Adding a day

Append new entries to the end of the list. The page sorts newest first by `date` and marks anything from the last two days as new.

Lesson fields: `id` (date plus a slug, unique), `date` (YYYY-MM-DD), `station` (one of `skills`, `mods`, `connectors`, `projects`, `designs`, `data`, `claudemd`, `duet`), `title`, `body` (one plain paragraph), `tryIt` (optional, one small exercise), `source` (`title` and `url`).

Recipe fields: `id`, `date`, `station`, `title`, `ingredients` (short list), `method` (the prompt itself, with [brackets] for the parts to fill in), `notes` (chef's notes), `source`.

## House rules

- Write for a curious family: plain words, one idea per entry, no jargon without a quick explanation.
- Only describe features that really exist, and check them on the source page first.
- Every `source.url` is an official Anthropic page you actually read: support.claude.com, docs.claude.com, platform.claude.com, code.claude.com, claude.com or anthropic.com.
- No repeats: check the existing titles and sources before adding a topic.
- Videos link one specific video page, never a search page.
