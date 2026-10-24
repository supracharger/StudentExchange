using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ListingController : ControllerBase
    {
        // Allowed values for Condition (saved exactly as written here)
        static readonly string[] _conditions = { "New", "Like New", "Good", "Fair", "Poor" };
        // ISBN is only accepted for this category. Must match what the frontend sends!
        const string TextbookCategory = "Textbooks";
        const int MaxImageBytes = 2 * 1024 * 1024;   // 2 MB

        /// <summary>
        /// Folder where listing images are saved: an 'uploads' folder next to the
        /// project's other data files (Env._bin). Program.cs serves it at /uploads.
        /// A property (not a field) so it is only read after Env.GetEnv() has run.
        /// </summary>
        public static string UploadsPath => Path.GetFullPath(Path.Combine(Env._bin, "uploads"));

        // GET: api/listing  (optional ?category=...)
        [HttpGet]
        public IActionResult GetListings(AppAuthJson auth, [FromQuery] string? category = null)
        {
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            try
            {
                var sql = "SELECT l.id, l.title, l.description, l.price, l.category, " +
                          "l.[condition], l.location, l.isbn, l.image, l.datetime, " +
                          "u.email, u.first_name, u.last_name " +
                          "FROM Listings l JOIN User u ON l.user_id = u.id ";
                var args = new Dictionary<string, object>();

                if (!string.IsNullOrWhiteSpace(category))
                {
                    sql += "WHERE l.category = @category ";
                    args.Add("@category", category);
                }
                sql += "ORDER BY l.datetime DESC";

                var result = Sql.Read(sql, args);

                // Sql.Read returns columns; rebuild one object per listing
                var listings = new List<object>();
                if (result.Count > 0)
                {
                    for (int i = 0; i < result["id"].Count; i++)
                    {
                        var image = Val(result["image"][i]) as string;
                        listings.Add(new
                        {
                            id = (long)result["id"][i],
                            title = Val(result["title"][i]),
                            description = Val(result["description"][i]),
                            price = Convert.ToDecimal(result["price"][i]),
                            category = Val(result["category"][i]),
                            condition = Val(result["condition"][i]),
                            location = Val(result["location"][i]),
                            isbn = Val(result["isbn"][i]),
                            image_url = image == null ? null : "/uploads/" + image,
                            datetime = Val(result["datetime"][i]),
                            email = DeterministicEncryption.Decrypt((string)result["email"][i], Env._emailSalt),
                            first_name = Val(result["first_name"][i]),
                            last_name = Val(result["last_name"][i])
                        });
                    }
                }
                return Ok(listings);
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }

        // POST: api/listing
        [HttpPost]
        public IActionResult CreateListing([FromBody] ListingCreateModel model)
        {
            var msg = AppAuthJson.ValidateWithToken(this, model, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            // Validate everything before touching the disk or database
            var error = ValidateListing(model, out var condition, out var isbn);
            if (error != null) return BadRequest(new { Message = error });

            // Save the image (if any)
            string? imageName = null;
            if (!string.IsNullOrWhiteSpace(model.ImageBase64))
            {
                imageName = SaveImage(model.ImageBase64, out error);
                if (imageName == null) return BadRequest(new { Message = error });
            }

            try
            {
                Sql.Write("INSERT INTO Listings (title, description, price, category, [condition], " +
                          "location, isbn, image, user_id, datetime) " +
                          "VALUES (@title, @description, @price, @category, @condition, " +
                          "@location, @isbn, @image, @user_id, @datetime)",
                    new Dictionary<string, object>
                    {
                        { "@title", model.Title.Trim() },
                        { "@description", model.Description ?? "" },
                        { "@price", model.Price },
                        { "@category", model.Category.Trim() },
                        { "@condition", condition },
                        { "@location", model.Location.Trim() },
                        // SQLite needs DBNull.Value (not null) to store an empty cell
                        { "@isbn", (object?)isbn ?? DBNull.Value },
                        { "@image", (object?)imageName ?? DBNull.Value },
                        { "@user_id", user.id },                       // from the token, not the client
                        { "@datetime", Utilz.ToMtn().ToString("s") }
                    }, 1);

                return Ok(new { message = "Listing created successfully!" });
            }
            catch (Exception e)
            {
                // The database insert failed, so don't leave an orphan image file behind
                if (imageName != null) DeleteImageFile(imageName);
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }

        // DELETE: api/listing/{id}
        [HttpDelete("{id}")]
        public IActionResult DeleteListing(long id, [FromBody] AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            try
            {
                // Who owns this listing, and does it have an image?
                var result = Sql.Read("SELECT [user_id], [image] FROM Listings WHERE [id]=@id",
                    new Dictionary<string, object> { { "@id", id } });
                if (result.Count == 0)
                    return NotFound(new { message = "Listing not found." });

                // Only the owner or an admin may delete it
                if ((long)result["user_id"][0] != user.id && !user.isAdmin)
                    return Unauthorized(new { Message = "Not authorized." });

                Sql.Write("DELETE FROM Listings WHERE [id]=@id",
                    new Dictionary<string, object> { { "@id", id } }, 1);

                // Remove the image file too
                if (Val(result["image"][0]) is string img) DeleteImageFile(img);

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
            var dir = UploadsPath;
            if (!Directory.Exists(dir)) return;

            // Every image filename that is still in use
            var result = Sql.Read("SELECT [image] FROM Listings WHERE [image] IS NOT NULL");
            var used = result.Count == 0
                ? new HashSet<string>()
                : result["image"].Select(o => (string)o).ToHashSet();

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

        // ---------------- Helpers ----------------

        // The database gives DBNull for empty cells; turn that into a normal null
        static object? Val(object o) => o is DBNull ? null : o;

        /// <summary>Returns an error message, or null if the listing is valid.</summary>
        static string? ValidateListing(ListingCreateModel m, out string condition, out string? isbn)
        {
            condition = "";
            isbn = null;

            if (string.IsNullOrWhiteSpace(m.Title) || m.Title.Trim().Length > 200)
                return "Title is required (max 200 characters).";
            if ((m.Description ?? "").Length > 2000)
                return "Description is too long (max 2000 characters).";
            if (m.Price < 0)
                return "Price cannot be negative.";
            if (string.IsNullOrWhiteSpace(m.Category))
                return "Category is required.";

            // Condition must match one of the allowed values (any capitalization)
            var match = _conditions.FirstOrDefault(c =>
                string.Equals(c, m.Condition?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match == null)
                return $"Condition must be one of: {string.Join(", ", _conditions)}.";
            condition = match;

            if (string.IsNullOrWhiteSpace(m.Location) || m.Location.Trim().Length > 100)
                return "Location is required (max 100 characters).";

            // ISBN: optional, textbooks only
            if (!string.IsNullOrWhiteSpace(m.Isbn))
            {
                if (!string.Equals(m.Category.Trim(), TextbookCategory, StringComparison.OrdinalIgnoreCase))
                    return "An ISBN can only be added to textbook listings.";

                var cleaned = m.Isbn.Replace("-", "").Replace(" ", "").ToUpperInvariant();
                if (!IsValidIsbn(cleaned))
                    return "That ISBN is not valid. Please check it and try again.";
                isbn = cleaned;
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
    }

    public class ListingCreateModel : AppAuthJson
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string? Isbn { get; set; }           // optional, textbooks only
        public string? ImageBase64 { get; set; }    // optional
    }
}