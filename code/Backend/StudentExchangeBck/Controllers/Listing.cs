using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck
{
    [Route("[controller]")]
    [ApiController]
    public class Listing : ControllerBase
    {
        // Allowed values for Condition (saved exactly as written here)
        //static readonly string[] _conditions = { "New", "Like New", "Good", "Fair", "Poor" };
        // ISBN is only accepted for this category. Must match what the frontend sends!
        const string TextbookCategory = "Textbooks";
        const string _noisbn = "[blank]";
        const int MaxImageBytes = 2 * 1024 * 1024;   // 2 MB

        /// <summary>
        /// Folder where listing images are saved: an 'uploads' folder next to the
        /// project's other data files (Env._bin). Program.cs serves it at /uploads.
        /// A property (not a field) so it is only read after Env.GetEnv() has run.
        /// </summary>
        public static string UploadsPath => Path.GetFullPath(Path.Combine(Env._bin, "public/uploads"));

        // GET: api/listing  (optional ?category=...)
        [HttpGet]
        public IActionResult GetListings(GetListingsJson data)
        {
            IP.Data ip;
            Users.Data user = new Users.Data();
            IActionResult? msg;
            var asuser = data.for_user != null;
            if (asuser)
                msg = AppAuthJson.ValidateWithToken(this, data, HttpContext, out user, out ip);
            else
                msg = AppAuthJson.ValidateApp(data, HttpContext, this, out ip);
            if (msg != null) return msg;

            if (asuser && user.forwarded && user.adminLvl < 10)
                return Unauthorized("Not Authorized.");

            if (!string.IsNullOrWhiteSpace(data.isbn))
            {
                var cleaned = data.isbn.Replace("-", "").Replace(" ", "").ToUpperInvariant();
                if (!IsValidIsbn(cleaned))
                    return BadRequest("That ISBN is not valid. Please check it and try again.");
                data.isbn = cleaned;
            }
            else data.isbn = null;

            try
            {
                var useCategory = !string.IsNullOrWhiteSpace(data.category);
                var sql = @"SELECT l.id, l.title, l.price, c.name category, 
                          cd.name condition, u.location, b.isbn, 
                          (
                           SELECT i.name FROM Img i 
                           WHERE i.list_id = l.id 
                           ORDER BY i.id LIMIT 1 
                          ) image, 
                          l.datetime, s.name status, u.user_name user
                          FROM Listings l, User u, Listings_Category c, Condition cd, status s 
                          LEFT JOIN Books b ON b.list_id=l.id
                          WHERE " +
                          (asuser ? "u.id=@userid AND " : "l.status=1 AND ") +
                          (useCategory ? "c.name=@category AND " : "") +
                          (data.isbn != null ? "b.isbn=@isbn AND " : "") +
                          @"l.user_id=u.id AND l.category=c.id AND l.condition=cd.id AND l.status=s.id
                          ORDER BY l.expiry; ";
                var args = new Dictionary<string, object>();

                if (useCategory)
                    args.Add("@category", data.category!);
                if (asuser)
                    args.Add("@userid", user.id);
                if (data.isbn != null)
                    args.Add("@isbn", data.isbn);

                var result = Sql.Read(sql, args);

                // Search
                if (result.Count != 0 && !string.IsNullOrWhiteSpace(data.search) && result.Values.First().Count > 1)
                {
                    var search = data.search.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    var titles = result["title"].Select(s => ((string)s).ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToArray();

                    var cache = new Dictionary<(string, string), int>();

                    var ii = Enumerable.Range(0, titles.Length).ToArray();

                    const int cutoff = 2000;
                    if (titles.Length > cutoff)
                    {
                        // Rank all listings cheaply first.
                        ii = ii.OrderBy(i => Utilz.SearchBasic(search, titles[i]))
                               .ThenBy(i => i)
                               .ToArray();

                        // Apply fuzzy scoring to the strongest 2,000 candidates.
                        var top = ii.Take(cutoff)
                            .OrderBy(i => Utilz.Search(search, titles[i], cache))
                            .ThenBy(i => i)
                            .ToArray();

                        ii = top.Concat(ii.Skip(cutoff)).ToArray();
                    }
                    else
                    {
                        ii = ii.OrderBy(i => Utilz.Search(search, titles[i], cache))
                               .ThenBy(i => i)
                               .ToArray();
                    }

                    foreach (var k in result.Keys.ToArray())
                    {
                        var v = result[k];
                        result[k] = ii.Select(i => v[i]).ToList();
                    }
                }

                // Sql.Read returns columns; rebuild one object per listing
                var listings = new List<object>();
                if (result.Count > 0)
                {
                    var keys = result.Keys.ToList();
                    if (!asuser) keys.Remove("status");

                    foreach (var k in new[] { "location", "isbn" })
                        result[k] = result[k].Select(Val).ToList()!;
                    if (result.TryGetValue("price", out var v))
                        result["price"] = v.Select(s => (object)Convert.ToDecimal(s)).ToList();
                    if (result.TryGetValue("image", out var v2))
                    {
                        result.Add("image_url", v2.Select(s => Val(s) != null ? (object)("/uploads/" + s): null!).ToList());
                        keys.Remove("image");
                        keys.Add("image_url");
                    }

                    var dta = Utilz.Transpose(keys.Select(k => result[k])).ToList();
                    var ii = Enumerable.Range(0, keys.Count).ToArray();

                    foreach (var row in dta)
                        listings.Add(ii.ToDictionary(i => keys[i], i => row[i]));
                }
                return Ok(listings);
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }

        [HttpGet("{id}")]
        public IActionResult GetOne(long id, AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateApp(auth, HttpContext, this, out var ip);
            if (msg != null) return msg;

            var did = new Dictionary<string, object>
                            {
                                { "@id", id }
                            };

            var result = Sql.Read(@"SELECT l.title, l.description, l.price, c.name category, 
                          cd.name condition, COALESCE(u.location, '') location, b.isbn, 
                          l.datetime, u.email, u.first_name, u.last_name, s.name status, u.user_name user
                          FROM Listings l, User u, Listings_Category c, Condition cd, status s 
                          LEFT JOIN Books b ON b.list_id=l.id
                          WHERE l.id=@id AND
                          l.user_id=u.id AND l.category=c.id AND l.condition=cd.id AND l.status=s.id; ", did);

            if (result.Count == 0)
                return BadRequest("Listing not found.");

            var data = result.ToDictionary(s => s.Key, s => Val(s.Value[0]));
            if (data.TryGetValue("email", out var email))
                data["email"] = DeterministicEncryption.Decrypt((string)email!, Env._emailSalt);

            result = Sql.Read("SELECT name FROM Img WHERE list_id=@id ORDER BY [id];", did);
            List<string>? imgs = null;
            if (result.Count != 0)
                imgs = result["name"].Select(n => "/uploads/" + ((string)n)).ToList();
            data.Add("images_url", imgs);

            return Ok(data);
        }

        // POST: api/listing
        [HttpPost]
        public IActionResult CreateListing([FromBody] ListingCreateModel model)
        {
            var msg = AppAuthJson.ValidateWithToken(this, model, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            // Validate everything before touching the disk or database
            var error = ValidateListing(model, out var condition, out var category, out var isbn, out var imgs);
            if (error != null) return BadRequest(new { Message = error });

            if (!string.IsNullOrWhiteSpace(model.Title))
                model.Title = Utilz.FirstUpper(model.Title, ignoreStopWords: true);

            string[]? imageName = null;
            // Save the image (if any)
            if (imgs != null)
            {
                imageName = new string[imgs.Length];
                for (int i = 0; i < imgs.Length; i++)
                {
                    imageName[i] = SaveImage(imgs[i], out error)!;
                    if (imageName[i] == null) return BadRequest(new { Message = $"Image: {i + 1} " + error });
                }
            }

            Sql.Trans? trans = null;
            try
            {
                trans = new Sql.Trans();
                long lid;
                Sql.Write(@"INSERT INTO Listings (title, description, price, category, [condition], 
                            user_id, datetime, expiry) 
                            VALUES (@title, @description, @price, @category, @condition, 
                            @user_id, @datetime, @expiry)", trans,
                    new Dictionary<string, object>
                    {
                    { "@title", model.Title.Trim() },
                    { "@description", model.Description ?? "" },
                    { "@price", model.Price },
                    { "@category", category },
                    { "@condition", condition },
                    // SQLite needs DBNull.Value (not null) to store an empty cell
                    //{ "@image", (object?)imageName ?? DBNull.Value },
                    { "@user_id", user.id },                       // from the token, not the client
                    { "@datetime", Utilz.ToMtn().ToString("s") },
                    { "@expiry", (Utilz.ToMtn() + Env._list_expiry).ToString("s") }
                    }, 1);

                lid = (long)Sql.Read("SELECT [id] FROM Listings WHERE user_id=@userid ORDER BY id DESC LIMIT 1",
                                    new Dictionary<string, object> { { "@userid", user.id } }, trans)["id"][0];

                if (isbn != null)
                {
                    if (isbn != _noisbn)
                        Sql.Write("INSERT INTO Books (list_id, isbn) VALUES (@lid, @isbn)", trans, new Dictionary<string, object>
                    {
                        { "@lid", lid },
                        { "@isbn", isbn }
                    }, 1);
                    else
                        Sql.Write("INSERT INTO Books (list_id) VALUES (@lid)", trans, new Dictionary<string, object>
                    {
                        { "@lid", lid }
                    }, 1);
                }

                if (imageName != null)
                {
                    var sql = "Insert INTO Img (list_id, name) VALUES "
                                + string.Join(", ", imageName.Select(n => $"(@lid, '{n}')"));
                    Sql.Write(sql, trans, new Dictionary<string, object>
                    {
                        { "@lid", lid }
                    }, imageName.Length);
                }

                trans.Commit();
                return StatusCode(201, new { message = "Listing created successfully!" });
            }
            catch (Exception e)
            {
                try { trans?.Rollback(); } catch { }
                // The database insert failed, so don't leave an orphan image file behind
                if (imageName != null) Array.ForEach(imageName, DeleteImageFile);
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }

        // DELETE: api/listing/{id}
        [HttpDelete]
        public IActionResult DeleteListing(Delete data)
        {
            var msg = AppAuthJson.ValidateWithToken(this, data, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            if (user.forwarded && user.adminLvl < 10)
                return Unauthorized("Not Authorized.");

            if (data.id == null)
                return BadRequest("There needs to be an id.");

            try
            {
                var idd = new Dictionary<string, object> { { "@id", data.id.Value } };
                // Who owns this listing, and does it have an image?
                var result = Sql.Read("SELECT [user_id] FROM Listings WHERE [id]=@id", idd);
                if (result.Count == 0)
                    return NotFound(new { message = "Listing not found." });

                // Only the owner or an admin may delete it
                if ((long)result["user_id"][0] != user.id)
                    return Unauthorized(new { Message = "Not authorized." });

                result = Sql.Read("SELECT [name] FROM Img WHERE [list_id]=@id", idd);
                if (result.Count != 0)
                {
                    foreach (var img in result["name"].Cast<string>())
                        if (Val(img) is string) DeleteImageFile(img);

                    Sql.Write("DELETE FROM Img WHERE [list_id]=@id", idd, result.Values.First().Count);
                }

                Sql.Write("DELETE FROM Listings WHERE [id]=@id", idd, 1);
                // Table Books CASCADES the delete

                return Ok(new { message = "Listing deleted successfully!" });
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }

        /// <summary>
        /// Occasionally should be used to clean up resources.
        /// Deletes image files that no listing points to anymore (for example, when a
        /// deleted user's listings were removed along with them).
        /// </summary>
        public static void CleanUp()
        {
            // DeActivate expired listings
            Sql.Write("UPDATE Listings SET [status]=3 WHERE status=1 AND expiry<@now;",
                    new Dictionary<string, object> { { "@now", Utilz.ToMtn().ToString("s") } }, -2);

            var dir = UploadsPath;
            if (!Directory.Exists(dir))
            {

                // Every image filename that is still in use
                var result = Sql.Read("SELECT [name] FROM Img");
                var used = result.Count == 0
                    ? new HashSet<string>()
                    : result["name"].Cast<string>().ToHashSet();

                foreach (var file in Directory.GetFiles(dir))
                {
                    // Still in use: keep it
                    if (used.Contains(Path.GetFileName(file))) continue;
                    // Very new: its database row may not have been inserted yet
                    if (System.IO.File.GetCreationTimeUtc(file) > DateTime.UtcNow.AddDays(-1)) continue;

                    try { System.IO.File.Delete(file); }
                    catch { /* best effort: try again tomorrow */ }
                }
            }
        }

        // ---------------- Helpers ----------------

        // The database gives DBNull for empty cells; turn that into a normal null
        static object? Val(object o) => o is DBNull ? null : o;

        /// <summary>Returns an error message, or null if the listing is valid.</summary>
        static string? ValidateListing(ListingCreateModel m, out long condition, out long category, out string? isbn,
                                        out string[]? imgs)
        {
            condition = category = -1;
            isbn = null;
            imgs = null;

            if (string.IsNullOrWhiteSpace(m.Title) || m.Title.Trim().Length > 200)
                return "Title is required (max 200 characters).";
            if ((m.Description ?? "").Length > 2000)
                return "Description is too long (max 2000 characters).";
            if (m.Price < 0)
                return "Price cannot be negative.";
            if (string.IsNullOrWhiteSpace(m.Category))
                return "Category is required.";

            // Condition must match one of the allowed values (any capitalization)
            var result = Sql.Read("SELECT [id],[name] FROM Condition");
            var conds = result["name"].Cast<string>().ToList();
            var cid = result["id"].Cast<long>().ToList();
            var match = conds.FirstOrDefault(c =>
                string.Equals(c, m.Condition?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match == null)
                return $"Condition must be one of: {string.Join(", ", conds)}.";
            condition = cid[conds.IndexOf(match)];

            // Category must be allowed
            result = Sql.Read("SELECT [id],[name] FROM Listings_Category");
            var cats = result["name"].Cast<string>().ToList();
            cid = result["id"].Cast<long>().ToList();
            match = cats.FirstOrDefault(c =>
                string.Equals(c, m.Category?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match == null)
                return $"Category must be one of: {string.Join(", ", conds)}.";
            category = cid[cats.IndexOf(match)];

            var isbook = string.Equals(m.Category.Trim(), TextbookCategory, StringComparison.OrdinalIgnoreCase);
            // ISBN: optional, textbooks only
            if (!string.IsNullOrWhiteSpace(m.Isbn))
            {
                if (!isbook)
                    return "An ISBN can only be added to textbook listings.";

                var cleaned = m.Isbn.Replace("-", "").Replace(" ", "").ToUpperInvariant();
                if (!IsValidIsbn(cleaned))
                    return "That ISBN is not valid. Please check it and try again.";
                isbn = cleaned;
            }
            else if (isbook)
                isbn = _noisbn;

            if (m.ImageBase64 != null)
            {
                if (m.ImageBase64.Length > 8)
                    return "There can be no more than 8 images";
                imgs = m.ImageBase64.Where(m => !string.IsNullOrWhiteSpace(m)).ToArray();
                if (imgs.Length == 0)
                    imgs = null;
            }

            return null;
        }

        static bool IsAsciiDigit(char c) => c >= '0' && c <= '9';

        // Checks length and the ISBN check digit
        static bool IsValidIsbn(string s)
        {
            if (s.Length == 13 && s.All(IsAsciiDigit))
            {
                int sum = 0;
                for (int i = 0; i < 12; i++)
                    sum += (s[i] - '0') * (i % 2 == 0 ? 1 : 3);
                return (10 - sum % 10) % 10 == s[12] - '0';
            }
            if (s.Length == 10 && s.Take(9).All(IsAsciiDigit) && (IsAsciiDigit(s[9]) || s[9] == 'X'))
            {
                int sum = 0;
                for (int i = 0; i < 10; i++)
                    sum += (s[i] == 'X' ? 10 : s[i] - '0') * (10 - i);
                return sum % 11 == 0;
            }
            return false;
        }

        /// <summary>Saves a base64 image to the uploads folder. Returns the filename, or null with an error.</summary>
        static string? SaveImage(string base64, out string? error)
        {
            error = null;

            // Accept "data:image/png;base64,AAAA..." as well as plain base64
            if (base64.StartsWith("data:") && base64.Contains(','))
                base64 = base64[(base64.IndexOf(',') + 1)..];

            // Don't even try to decode something far too large
            if (base64.Length > MaxImageBytes * 4 / 3 + 100)
            {
                error = "Image must be under 2 MB.";
                return null;
            }

            byte[] bytes;
            try { bytes = Convert.FromBase64String(base64); }
            catch (FormatException) { error = "Image is not valid base64."; return null; }

            if (bytes.Length < 12 || bytes.Length > MaxImageBytes)
            {
                error = "Image must be under 2 MB.";
                return null;
            }

            // Work out the real type from the first bytes, not from anything the client says
            string? ext = null;
            if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) ext = ".png";
            else if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) ext = ".jpg";
            else if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' &&
                     bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') ext = ".webp";

            if (ext == null)
            {
                error = "Image must be a PNG, JPEG, or WebP file.";
                return null;
            }

            Directory.CreateDirectory(UploadsPath);

            // Random name: never use a name supplied by the user
            var name = Guid.NewGuid().ToString("N") + ext;
            System.IO.File.WriteAllBytes(Path.Combine(UploadsPath, name), bytes);   // System.IO.File: ControllerBase has its own File()
            return name;
        }

        static void DeleteImageFile(string name)
        {
            try
            {
                // Path.GetFileName strips any folder parts, so only files inside uploads can be touched
                var path = Path.Combine(UploadsPath, Path.GetFileName(name));
                if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            }
            catch { /* best effort: a leftover file is harmless, and CleanUp will catch it */ }
        }

        public class Delete : AppAuthJson
        {
            public long? id { get; set; }
        }
    }

    public class GetListingsJson : AppAuthJson
    {
        public string? search { get; set; } = null;
        public string? category { get; set; } = null;
        public string? for_user { get; set; } = null;
        public string? isbn { get; set; } = null;
    }

    public class ListingCreateModel : AppAuthJson
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string? Isbn { get; set; }           // optional, textbooks only
        public string[]? ImageBase64 { get; set; }    // optional
    }
}