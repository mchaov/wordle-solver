"""Build the solver's two English lists from the pinned sources in the README."""

import argparse
import hashlib
import json
import re
import sqlite3
from contextlib import closing
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "words" / "words"
WORDNIK_SHA256 = "bfd1b4eb4ade1ba81e84c7e24248b9a1aecec9d9baa427453b367a83e30e0451"

# ESDB uses "_" for shared spellings and "" for entries with no regional restriction.
# Check the spelling as published. Lowercasing a name would create a new entry.
AMERICAN_WORDS = """
    SELECT word, MAX(size <= 60 AND category = '') AS in_standard_dictionary
    FROM scowl_v0
    WHERE spelling IN ('A', '_') AND region IN ('US', '')
      AND size <= 80 AND variant_level <= 6
      AND category IN ('', 'hacker')
      AND (pos_category = '' OR base_pos = 's')
      AND pos_class IN ('', 'number', 'ordinal') AND usage_note <> 'nonstandard'
      AND length(word) IN (5, 6) AND word NOT GLOB '*[^a-z]*'
    GROUP BY word
    ORDER BY word
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scowl_db", type=Path)
    parser.add_argument("wordnik_list", type=Path)
    parser.add_argument("--check", action="store_true", help="compare with the checked-in lists")
    args = parser.parse_args()

    wordnik = args.wordnik_list.read_text(encoding="utf-8")
    if hashlib.sha256(wordnik.encode("utf-8")).hexdigest() != WORDNIK_SHA256:
        parser.error("expected the July 29, 2021 Wordnik word list")
    game_words = set(re.findall(r'^"([a-z]{5,6})"$', wordnik, re.MULTILINE))

    by_length = {5: [], 6: []}
    with closing(sqlite3.connect(args.scowl_db.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        for word, in_standard_dictionary in db.execute(AMERICAN_WORDS):
            if in_standard_dictionary or word in game_words:
                by_length[len(word)].append(word)

    for length, words in by_length.items():
        path = OUTPUT / f"english{length}.json"
        content = json.dumps(words, indent=2) + "\n"
        if args.check:
            if path.read_text(encoding="utf-8") != content:
                raise SystemExit(f"{path.name} differs from the source dictionaries")
        else:
            path.write_bytes(content.encode("utf-8"))
        print(f"{path.name}  {len(words):,} words")


if __name__ == "__main__":
    main()
