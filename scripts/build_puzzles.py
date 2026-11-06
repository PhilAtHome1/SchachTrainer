"""Erzeugt die mitgelieferten Rätseldateien aus der Lichess-Rätseldatenbank (CC0).

Aufruf: python3 scripts/build_puzzles.py <lichess_db_puzzle.csv.zst> public/puzzles
Benötigt: pip install zstandard
"""
import csv, io, json, random, sys
import zstandard

LEVELS = {"leicht": (400, 1199), "mittel": (1200, 1799), "schwer": (1800, 2700)}
PER_LEVEL = 3000

def main(src, out_dir):
    rng = random.Random(42)
    reservoirs = {k: [] for k in LEVELS}
    seen = {k: 0 for k in LEVELS}
    with open(src, "rb") as fh:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8")
        for row in csv.DictReader(reader):
            try:
                rating, pop, plays, rd = int(row["Rating"]), int(row["Popularity"]), int(row["NbPlays"]), int(row["RatingDeviation"])
            except ValueError:
                continue
            if pop < 90 or plays < 2000 or rd > 80:
                continue
            for level, (lo, hi) in LEVELS.items():
                if lo <= rating <= hi:
                    seen[level] += 1
                    res = reservoirs[level]
                    item = [row["PuzzleId"], row["FEN"], row["Moves"], rating, row["Themes"]]
                    if len(res) < PER_LEVEL:
                        res.append(item)
                    else:
                        j = rng.randrange(seen[level])
                        if j < PER_LEVEL:
                            res[j] = item
                    break
    for level, res in reservoirs.items():
        res.sort(key=lambda p: p[3])
        with open(f"{out_dir}/{level}.json", "w") as f:
            json.dump(res, f, separators=(",", ":"))
        print(level, len(res), "von", seen[level])

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
