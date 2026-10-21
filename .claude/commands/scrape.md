# /scrape - Find Matching Jobs

You are running the job search. Follow `.claude/skills/job-scraper/SKILL.md` from Step 0 through the end. That file is the procedure. Do not invent a second one.

`$ARGUMENTS` are the skill's optional arguments: a focus area, `broad`, or `health` (and an optional portal name after `health`).

The skill runs the portal CLIs under `.agents/skills/*-search/`. Boss直聘 is `zhipin-search` and 猎聘 is `liepin-search`. A missing login or a verification page on those two is a stop, as that skill already says.
