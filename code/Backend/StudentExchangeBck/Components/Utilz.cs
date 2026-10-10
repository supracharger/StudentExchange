/*
 Transpose():
    Transpose Collection:
    source[m][n] --> source[n][m]

 FirstUpper():
    Changes words in a sentenence (Split by ' ') to first upper.
    'hello world' --> 'Hello World'

 ToMtn():
    Converts DateTime UTC to Mountain Standard Time.
    If no args: it uses current UTC time
 */

using System.Collections.Immutable;

namespace StudentExchangeBck
{
    public static class Utilz
    {
        /// <summary>
        /// Transpose Collection:
        /// source[m][n] --> source[n][m]
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="source">Collection to Transpose</param>
        /// <returns></returns>
        public static IEnumerable<List<T>> Transpose<T>(IEnumerable<IEnumerable<T>> source) =>
            source.SelectMany(inner => inner.Select((item, index) => new { item, index }))
            .GroupBy(i => i.index, i => i.item).Select(g => g.ToList());

        public static readonly IDictionary<string, string> _stopWords
            = "a an the and or but in on at of to for is are was were be".Split()
            .ToImmutableDictionary(s => FirstUpper(s), s => s.ToLower());

        /// <summary>
        /// Changes words in a sentenence (Split by ' ') to first upper.
        /// 'hello world' --> 'Hello World'
        /// </summary>
        /// <param name="txt">text to change</param>
        /// <returns>Changed text</returns>
        public static string FirstUpper(string txt, bool ignoreStopWords = false)
        {
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
                for (int i = 0; i < split.Length; i++)
                    if (_stopWords.TryGetValue(split[i], out var stop))
                        split[i] = stop;

            return string.Join(' ', split);
        }

        static readonly TimeZoneInfo _mountainZone = TimeZoneInfo.FindSystemTimeZoneById("Mountain Standard Time");
        /// <summary>
        /// Converts DateTime UTC to Mountain Standard Time.
        /// If no args: it uses current UTC time
        /// </summary>
        /// <param name="utc">UTC to convert. If no args: it uses current UTC time</param>
        /// <returns>Mountian Time</returns>
        public static DateTime ToMtn(DateTime? utc = null)
        {
            if (utc == null) utc = DateTime.UtcNow;
            return TimeZoneInfo.ConvertTimeFromUtc(utc.Value, _mountainZone);
        }
    }
}
