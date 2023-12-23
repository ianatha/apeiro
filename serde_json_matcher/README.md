# serde_json_matcher &emsp; [![Build Status]][actions] [![Latest Version]][crates.io]

[Build Status]: https://img.shields.io/github/actions/workflow/status/ianatha/serde_json_matcher/ci.yml?branch=main
[actions]: https://github.com/ianatha/serde_json_matcher/actions?query=branch%3Amaster
[Latest Version]: https://img.shields.io/crates/v/serde_json_matcher.svg
[crates.io]: https://crates.io/crates/serde\_json\_matcher

Implements a matcher for `serde_json::Value`s using the MongoDB query language in Rust.

Currently supports `$eq`, `$in`, `$ne`, `$nin`, `$and`, `$not`, `$or`, `$type` and `$nor`.
