#!/bin/bash

TEST_DATA_DIR="$HOME/github/actions-workflow-parser/testdata/reader"

REPO_ROOT="$(git rev-parse --show-toplevel)"

DEST_DIR="$REPO_ROOT/actions-workflow-parser/testdata/reader"

cp -f "$TEST_DATA_DIR"/* "$DEST_DIR"/
