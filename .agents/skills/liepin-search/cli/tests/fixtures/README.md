# 猎聘 parser fixtures

Reduced structural samples for offline tests. Not live page dumps.

`class="salary"` is the current job. `class="job-salary"` is a different token
and must not be read as this job's salary. City codes in the parser still
need a check against a logged-in browser; see `url-reference.md`.
