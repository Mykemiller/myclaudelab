# The Curiosity Workshop (myclaudelab.com)

A family-only learning site for Claude. Static HTML, CSS and vanilla JS with no build step, hosted on Vercel.

## Where things live

- `index.html` page shell, `styles.css` all styles, `app.js` all behavior.
- `content/*.json` every word a visitor reads. Rules and schemas: `content/README.md`. Read it before adding or editing content.
- `img/v2/` workshop scenes (`name.webp` large, `name-s.webp` small).
- `middleware.js` the family password gate (password lives in the `FAMILY_PASSWORD` environment variable).
- `api/director.js` hands out fresh links to the Lab Director's private HeyGen clips when `HEYGEN_API_KEY` is set.

## Rules that prevent real mistakes

- Never push to `main`: every push there goes live. Use a branch and a pull request; Myke merges.
- Content changes go in JSON, not in `app.js`.
- Only describe Claude features you verified on an official Anthropic page, and cite it.
- Keep secrets out of the repo. Keys and passwords belong in Vercel environment variables.
- Progress is stored per learner in the browser (`localStorage` key `cw:v3`). Don't rename that key without a migration.
- Previews are behind the family password, so test locally: serve the folder and load it in a headless browser at desktop and phone widths, with and without reduced motion.
