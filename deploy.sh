#!/usr/bin/env bash

(cd public/ && git fetch && git reset --hard origin/main --)
deno task build
(cd public/ && git add -A . && git commit -m "Deploy: $(date)" && git push)
