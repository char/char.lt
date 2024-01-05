#!/usr/bin/env bash

deno task build
(cd public/ && git add -A . && git commit -m "Deploy: $(date)" && git push)
