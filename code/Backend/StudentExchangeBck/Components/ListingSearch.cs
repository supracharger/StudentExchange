using System.Globalization;
using System.Text;
 
/* ListingSearch: scores how well a listing title matches what the user typed.
 
   Score(search, tx):
        Returns a number where LOWER IS BETTER (0 = perfect), the same direction as Utilz.Search.
        Returns ListingSearch.NoMatch (int.MaxValue) when the listing is NOT relevant.
        The caller must drop NoMatch results; that is what stops unrelated listings from showing up.
 
   What it understands:
        - capitalization, accents, and punctuation are ignored      ("Café" = "cafe", "calculus:" = "calculus")
        - simple plurals                                            ("textbooks" = "textbook")
        - partly typed words                                        ("calc" finds "Calculus")
        - small typos, based on the length of the word              ("calclus" finds "Calculus")
        - stop words are ignored                                    ("the lamp" = "lamp")
        - every typed word must match some word of the title (relaxed = true: at least half of them)
 */
 
namespace StudentExchangeBck
{
    public static class ListingSearch
    {
        /// <summary>Returned for listings that are not relevant to the search. Drop these.</summary>
        public const int NoMatch = int.MaxValue;
 
        // Words that carry no meaning on their own. Ignored unless the search is only these.
        static readonly HashSet<string> _stopWords = new()
        {
            "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with"
        };
 
        /// <summary>
        /// Score a listing title against the typed search. Lower is better. NoMatch = not relevant.
        /// </summary>
        /// <param name="search">Words the user typed</param>
        /// <param name="tx">Words of the listing title</param>
        /// <param name="cache">Remembers edit distances between pairs of words (optional)</param>
        /// <param name="relaxed">false: every typed word must match. true: at least half of them.</param>
        public static int Score(string[] search, string[] tx, Dictionary<(string, string), int>? cache = null, bool relaxed = false)
        {
            if (search.Length == 0 || tx.Length == 0)
                return NoMatch;
 
            cache ??= new Dictionary<(string, string), int>();
 
            var title = tx.Select(Normalize).Where(t => t.Length > 0).ToArray();
            var words = search.Select(Normalize).Where(w => w.Length > 0).Distinct().ToArray();
 
            // Ignore stop words, unless that would leave nothing to search for
            var useful = words.Where(w => !_stopWords.Contains(w)).ToArray();
            if (useful.Length > 0) words = useful;
 
            if (title.Length == 0 || words.Length == 0)
                return NoMatch;
 
            int cost = 0;        // how imperfect the matching words are
            int matched = 0;     // how many typed words found a match
            int disorder = 0;    // matches that are out of order or far apart in the title
            int previous = -1;
 
            foreach (var word in words)
            {
                int best = -1;
                int bestIndex = -1;
 
                for (int j = 0; j < title.Length; j++)
                {
                    var c = WordCost(word, title[j], cache);
                    if (c >= 0 && (best < 0 || c < best))
                    {
                        best = c;
                        bestIndex = j;
                        if (c == 0) break;   // can't beat an exact match
                    }
                }
 
                if (best < 0) continue;      // this word matched nothing in the title
 
                matched++;
                cost += best;
                if (previous >= 0 && (bestIndex < previous || bestIndex > previous + 1))
                    disorder++;
                previous = bestIndex;
            }
 
            // Not enough of the typed words matched: this listing is not relevant
            var needed = relaxed ? (int)Math.Ceiling(words.Length / 2.0) : words.Length;
            if (matched < Math.Max(1, needed))
                return NoMatch;
 
            var missed = words.Length - matched;
 
            // Word quality counts most. Smaller things break ties:
            // words in the wrong order, and long titles (a short, focused title is a better match).
            return cost * 4
                 + missed * 20
                 + Math.Min(disorder, 3)
                 + Math.Clamp(title.Length - matched, 0, 3);
        }
 
        /// <summary>
        /// How well one typed word matches one title word.
        /// 0 exact, 1 partly typed, 2 one typo, 3 inside a longer word, 4 two typos. -1: no match.
        /// </summary>
        static int WordCost(string term, string token, Dictionary<(string, string), int> cache)
        {
            if (term == token) return 0;
 
            // The user is still typing: "calc" -> "calculus"
            if (term.Length >= 2 && token.StartsWith(term, StringComparison.Ordinal)) return 1;
 
            // Typos. Short words may have 1 wrong letter, longer words 2. Words under 4 letters must be exact.
            int typos = int.MaxValue;
            if (term.Length >= 4)
            {
                var allowed = term.Length <= 5 ? 1 : 2;
                var d = Distance(term, token, cache);
                if (d <= allowed) typos = d;
            }
            if (typos == 1) return 2;
 
            // Inside a longer word: "fridge" -> "minifridge"
            if (term.Length >= 3 && token.Contains(term, StringComparison.Ordinal)) return 3;
 
            // A typo in a word that is still being typed: "calcil" -> "calculus"
            if (term.Length >= 4 && token.Length > term.Length
                && Distance(term, token[..term.Length], cache) <= 1)
                return 3;
 
            if (typos == 2) return 4;
 
            return -1;
        }
 
        // Edit distance between two words, remembered in the cache.
        // Distance is the same both ways, so the pair is stored in a fixed order.
        static int Distance(string a, string b, Dictionary<(string, string), int> cache)
        {
            var key = string.CompareOrdinal(a, b) <= 0 ? (a, b) : (b, a);
            if (!cache.TryGetValue(key, out var d))
            {
                d = Utilz.LevenshteinEditDistance(a, b);
                cache.Add(key, d);
            }
            return d;
        }
 
        // Lowercase, remove accents and punctuation, and strip a simple plural: "Café:" -> "cafe", "textbooks" -> "textbook"
        static string Normalize(string word)
        {
            var decomposed = word.ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (var c in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(c)) sb.Append(c);
            }
 
            var w = sb.ToString();
            // "textbooks" -> "textbook", but leave "calculus", "analysis" and "class" alone
            if (w.Length > 3 && w.EndsWith('s') && !w.EndsWith("ss") && !w.EndsWith("us") && !w.EndsWith("is"))
                w = w[..^1];
            return w;
        }
    }
}