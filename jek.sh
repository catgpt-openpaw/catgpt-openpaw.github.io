#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .jekyll.pid ]]; then
  old_pid="$(cat .jekyll.pid)"
  if kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid"
  fi
  rm -f .jekyll.pid
fi

bundle exec jekyll serve > .jekyll.log 2>&1 &
jekyll_pid=$!
echo "$jekyll_pid" > .jekyll.pid

cleanup() {
  rm -f .jekyll.pid
}
trap cleanup EXIT

for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:4000/ >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$jekyll_pid" 2>/dev/null; then
    cat .jekyll.log
    exit 1
  fi
  sleep 0.2
done

open -a Safari http://127.0.0.1:4000/
wait "$jekyll_pid"
