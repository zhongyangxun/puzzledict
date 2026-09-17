# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

<!-- Move items here into a new version section when cutting a release. -->

## [1.0.5] - 2026-09-17

### Fixed

- Logo button did not appear when selected text contained typographic characters (such as °C, an ellipsis, or an emoji)

## [1.0.4] - 2026-08-31

### Changed

- Speed up lookup with connection warm-up and parallel local dictionary loads

### Fixed

- Non-lemma lookups lacked word roots even when the lemma had roots
- Pop-up logo and translate panel followed system theme instead of the page theme when the system was in dark mode
- Phonetic text sometimes showed extra junk after a semicolon (now only the primary phonetic symbol is shown)

## [1.0.3] - 2026-08-08

### Fixed

- Logo button intermittently fails to appear on SPA pages that replace `document.body`

## [1.0.2] - 2026-08-06

### Changed

- Tighten phrase / token detection so more lookups go straight to translate
  instead of a dict miss then fallback

## [1.0.1] - 2026-07-22

### Added

- Expand word-roots coverage to the top 10,000 words

### Fixed

- Keep text selection when right-clicking selected text

## [1.0.0] - 2026-07-01

### Added

- Translate selected text
- Show word roots and affixes
- Pronunciation

[Unreleased]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.5...HEAD
[1.0.5]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/zhongyangxun/puzzledict/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/zhongyangxun/puzzledict/releases/tag/v1.0.0
