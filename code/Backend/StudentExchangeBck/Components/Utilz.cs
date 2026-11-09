/*
 FirstUpper():
    Changes words in a sentenence (Split by ' ') to first upper.
    'hello world' --> 'Hello World'

 ToMtn():
    Converts DateTime UTC to Mountain Standard Time.
    If no args: it uses current UTC time

 Search():
    Scores a listing title against the typed search (lower is better).
    The scoring itself lives in ListingSearch.cs. ListingSearch.NoMatch means "not relevant".
 */

using System.Collections.Immutable;

namespace StudentExchangeBck
{
    public static class Utilz
    {//toolbox of small helper functions
        //transpose flips rows into columns
        public static IEnumerable<List<T>> Transpose<T>(IEnumerable<IEnumerable<T>> source) =>
            source.SelectMany(inner => inner.Select((item, index) => new { item, index }))
            .GroupBy(i => i.index, i => i.item).Select(g => g.ToList());

        public static readonly IDictionary<string, string> _stopWords
            = "a an the and or but in on at of to for is are was were be".Split()
            .ToImmutableDictionary(s => FirstUpper(s), s => s.ToLower());

        public static string FirstUpper(string txt, bool ignoreStopWords = false)
        {//FirstUpper lowercases everything after the first letter
            var split = txt.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < split.Length; i++)
            {
                var w = split[i];
                if (w.Length >= 2)
                    split[i] = w.ToUpper().Substring(0, 1) + w.ToLower().Substring(1);
                else if (w.Length == 1)
                    split[i] = w.ToUpper();
            }

            if (ignoreStopWords)
                for (int i = 1; i < split.Length; i++)  //i=1: if 1st word is a stop word ignore it.
                    if (_stopWords.TryGetValue(split[i], out var stop))
                        split[i] = stop;

            return string.Join(' ', split);
        }

        static readonly TimeZoneInfo _mountainZone = TimeZoneInfo.FindSystemTimeZoneById("Mountain Standard Time");

        public static DateTime ToMtn(DateTime? utc = null)
        {//convert to MTN time
            if (utc == null) utc = DateTime.UtcNow;
            return TimeZoneInfo.ConvertTimeFromUtc(utc.Value, _mountainZone);
        }

        /// <summary>
        /// Levenshtein Edit Distance Algorithm.
        /// </summary>
        /// <param name="a">word 'a' to compare with word 'b'.</param>
        /// <param name="b">word 'b' to compare with word 'a'.</param>
        /// <returns>Edit Distance</returns>
        public static int LevenshteinEditDistance(string a_, string b_)
        {
            var a = a_.ToCharArray();
            var b = b_.ToCharArray();
            var alen = a.Length + 1;
            var blen = b.Length + 1;
            var dist = new int[alen * blen];
            // Init Delete all from 'b'
            for (int i = 0; i < alen; i++)
                dist[i * blen] = i;
            // Init Insert all from 'a'
            for (int j = 0; j < blen; j++)
                dist[j] = j;
            // Bottom Up Loop word 'a'
            for (int I = 1; I < alen; I++)
                // Bottom Up Loop word 'b'
                for (int J = 1; J < blen; J++)
                {
                    // if equal: no cost. else cost of 1 to replace
                    var cost = (a[I - 1] == b[J - 1]) ? 0 : 1;
                    // Minimum edit dist for row & col
                    dist[I * blen + J] = Math.Min(
                        dist[I * blen + J - 1] + 1,                 // Insert cost
                        Math.Min(
                            dist[(I - 1) * blen + J] + 1,           // Delete cost
                            dist[(I - 1) * blen + J - 1] + cost     // Replace cost
                        )
                    );
                }
            return dist[dist.Length - 1];
        }

        /// <summary>
        /// Scores a listing title against the typed search. LOWER IS BETTER.
        /// Returns ListingSearch.NoMatch (int.MaxValue) when the listing is not relevant:
        /// callers must drop those results.
        /// </summary>
        /// <param name="search">Words the user typed</param>
        /// <param name="tx">Words of the listing title</param>
        /// <param name="cache">Remembers edit distances between pairs of words (optional)</param>
        /// <param name="relaxed">false: every typed word must match. true: at least half of them.</param>
        public static int Search(string[] search, string[] tx, Dictionary<(string, string), int>? cache = null, bool relaxed = false)
            => ListingSearch.Score(search, tx, cache, relaxed);

        public static int SearchBasic(string[] search, string[] tx)
        {
            if (search.Length == 0 || tx.Length == 0)
                return int.MaxValue;

            int score = 0;
            int previous = -1;

            var txd = new Dictionary<string, List<int>>(tx.Length);

            for (int i = 0; i < tx.Length; i++)
            {
                if (!txd.TryGetValue(tx[i], out var positions))
                {
                    positions = new List<int>();
                    txd.Add(tx[i], positions);
                }

                positions.Add(i);
            }

            var used = new bool[tx.Length];

            for (int i = 0; i < search.Length; i++)
            {
                if (!txd.TryGetValue(search[i], out var positions))
                {
                    score += 2;
                    continue;
                }

                int bestIndex = -1;
                int bestPenalty = int.MaxValue;

                foreach (var pos in positions)
                {
                    if (used[pos])
                        continue;

                    int penalty = 0;

                    if (previous >= 0)
                    {
                        if (pos < previous)
                            penalty = previous - pos;
                        else if (pos > previous + 1)
                            penalty = pos - previous - 1;
                    }

                    if (penalty < bestPenalty)
                    {
                        bestPenalty = penalty;
                        bestIndex = pos;

                        if (penalty == 0)
                            break;
                    }
                }

                // All occurrences already used.
                if (bestIndex < 0)
                {
                    score += 2;
                    continue;
                }

                used[bestIndex] = true;

                score += 1 + bestPenalty;
                previous = bestIndex;
            }

            // Penalize missing title words.
            score += Math.Max(0, search.Length - tx.Length) * 2;

            return score;
        }
    }
}