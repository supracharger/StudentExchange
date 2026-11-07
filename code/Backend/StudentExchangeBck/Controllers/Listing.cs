using Microsoft.AspNetCore.Mvc;
using static StudentExchangeBck.Listing;

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
        const int MaxImgCnt = 8;

        static readonly Dictionary<long, (object lck, DateTime dt)> _lsLock
            = new Dictionary<long, (object, DateTime)>();

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
                          l.datetime, s.name status, u.user_name user, COALESCE(h.count, 0) hit " +
                          (asuser ?
                            ", FLOOR(JULIANDAY(MIN(l.expiry, COALESCE(a.expiry, l.expiry))) - JULIANDAY(@now)) days "
                            : "") +
                          @"FROM Listings l, User u, Listings_Category c, Condition cd, status s
                          LEFT JOIN Books b ON b.list_id=l.id
                          LEFT JOIN Hit_Count h ON l.id=h.list_id " +
                          (asuser ? "LEFT JOIN Check_Active a ON l.id=a.list_id " : "") +
                          "WHERE " +
                          (asuser ? "u.id=@userid AND " : "s.name IN ('Active', 'Sold') AND ") +
                          (useCategory ? "c.name=@category AND " : "") +
                          (data.isbn != null ? "b.isbn=@isbn AND " : "") +
                          @"l.user_id=u.id AND l.category=c.id AND l.condition=cd.id AND l.status=s.id
                          ORDER BY hit DESC, l.expiry; ";
                var args = new Dictionary<string, object>();

                if (useCategory)
                    args.Add("@category", data.category!);
                if (asuser)
                {
                    args.Add("@userid", user.id);
                    args.Add("@now", Utilz.ToMtn().ToString("s"));
                }
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
                    keys.Remove("hit");
                    //if (!asuser) keys.Remove("status");

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

            IncHitCount(id, ip.id, 1);

            lock (GetListLock(id))
                MakeSureActive(id);

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
                trans = null;
                return StatusCode(201, new { message = "Listing created successfully!" });
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
            finally 
            { 
                try { trans?.Rollback(); } catch { }
                // IF The database insert failed: don't leave an orphan image file behind
                if (trans != null && imageName != null)
                    Array.ForEach(imageName, DeleteImageFile);
            }
        }

        [HttpPatch("{id}")]
        public IActionResult UpdateListing(long id, Update model)
        {
            var msg = AppAuthJson.ValidateWithToken(this, model, HttpContext, out var user, out var ip);
            if (msg != null) return msg;

            if (user.forwarded && user.adminLvl < 10)
                return Unauthorized("Not Authorized.");

            var updatekeys = new HashSet<string> { "title", "description", "price", "category", "condition", "status" };
            var nullkeys = new HashSet<string>();
            if (string.IsNullOrWhiteSpace(model.Title))
            { model.Title = null; nullkeys.Add("title"); }
            if (string.IsNullOrWhiteSpace(model.Description))
            { model.Description = null; nullkeys.Add("description"); }
            if (model.Price == null)
            { model.Price = null; nullkeys.Add("price"); }
            if (string.IsNullOrWhiteSpace(model.Category))
            { model.Category = null; nullkeys.Add("category"); }
            if (string.IsNullOrWhiteSpace(model.Condition))
            { model.Condition = null; nullkeys.Add("condition"); }
            if (string.IsNullOrEmpty(model.status))
            { model.status = null; nullkeys.Add("status"); }
            if (model.Imgs != null && model.Imgs.Length == 0)
                model.Imgs = null;
            if (string.IsNullOrWhiteSpace(model.Isbn))
                model.Isbn = null;

            if (nullkeys.Count == updatekeys.Count && model.Imgs == null && model.Isbn == null)
                return BadRequest("There is nothing to update");
            if (nullkeys.Any(k => !updatekeys.Contains(k)))
                throw new Exception("nullkeys.Any(k => !updatekeys.Contains(k))");
            //foreach (var k in nullkeys)
            //    updatekeys.Remove(k);

            nullkeys = nullkeys.Select(k => "L." + k).ToHashSet();
            if (nullkeys.Contains("L.category"))
            {
                nullkeys.Remove("L.category");
                nullkeys.Add("C.name category");
            }
            if (nullkeys.Contains("L.condition"))
            {
                nullkeys.Remove("L.condition");
                nullkeys.Add("D.name condition");
            }
            nullkeys.Remove("L.status");
            nullkeys.Add("S.name status");
            nullkeys.Add("L.expiry");
            var col = nullkeys;
            var result = Sql.Read($"SELECT {string.Join(", ", col)} " + 
                                    @"FROM Listings L, Listings_Category C, Condition D, Status S
                                    WHERE L.id=@id AND L.user_id=@userid AND
                                    L.category=C.id AND L.condition=D.id AND L.status=S.id;",
                            new Dictionary<string, object>
                            {
                                { "@id", id },
                                { "@userid", user.id }
                            });

            if (result.Count == 0)
                return BadRequest("Listing not found.");

            var m0 = new ListingCreateModel()
            {
                Title = model.Title != null ? model.Title : (string)result["title"][0],
                Description = model.Description != null ? model.Description : (string)result["description"][0],
                Price = model.Price != null ? model.Price.Value : Convert.ToDecimal(result["price"][0]),
                Category = model.Category != null ? model.Category : (string)result["category"][0],
                Condition = model.Condition != null ? model.Condition : (string)result["condition"][0],
                Isbn = model.Isbn
            };
            var exp = (string)result["expiry"][0];

            var status = (string)result["status"][0];
            var r2 = Sql.Read("SELECT id,name,lvl FROM Status");
            if (r2.Count == 0) throw new Exception("There are no statuses");
            var sid = r2["id"].Cast<long>().ToArray();
            var stname = r2["name"].Cast<string>().ToArray();
            var slvl0 = r2["lvl"].Cast<long>().ToArray();
            var statusD = Enumerable.Range(0, sid.Length).ToDictionary(i => stname[i], i => sid[i]);
            var slvl = Enumerable.Range(0, sid.Length).ToDictionary(i => stname[i], i => slvl0[i]);
            slvl.Add("Renew", 0);

            if (model.status != null && model.status == status)
                model.status = null;
            if (!statusD.ContainsKey(status))
                throw new Exception("status could not be found.");
            if (slvl[status] > 1 && user.adminLvl < 10)
                return Unauthorized();
            if (model.status != null && (!slvl.ContainsKey(model.status) || (slvl[model.status] > 0 && user.adminLvl < 10)))
                return Unauthorized();

            // Validate everything before touching the disk or database
            var error = ValidateListing(m0, out var condition, out var category, out var isbn, out var imgs);
            if (error != null) return BadRequest(new { Message = error });

            if (!string.IsNullOrWhiteSpace(model.Title))
                model.Title = Utilz.FirstUpper(model.Title, ignoreStopWords: true);

            Sql.Trans? trans = null;
            List<string>? imgReplace = null, imgInsert = null;
            try
            {
                trans = new Sql.Trans();

                string? expiry = null;
                if (model.status == "Renew")
                {
                    var r = Sql.Read("SELECT expiry FROM Check_Active WHERE list_id=@id;", new Dictionary<string, object>
                            {
                                { "@id", id }
                            }, trans);
                    string? exp2 = null;
                    if (r.Count != 0)
                        exp2 = (string)r["expiry"][0];

                    var found = false;
                    var now = Utilz.ToMtn();
                    if ((int)((DateTime.Parse(exp) - now).TotalDays) <= Env._renewDays)
                    {
                        expiry = (now + Env._list_expiry).ToString("s");
                        found = true;
                    }
                    if (exp2 != null && (int)((DateTime.Parse(exp2) - now).TotalDays) <= Env._renewDays)
                    {
                        Sql.Write("DELETE FROM Check_Active WHERE list_id=@id;", trans, new Dictionary<string, object>
                        {
                            { "@id", id }
                        }, 1);
                        found = true;
                    }

                    if (!found)
                        return BadRequest($"It is too early to renew you need to wait till {Env._renewDays} days before the listing expires.");

                    model.status = "Active";
                    if (model.status == status)
                        model.status = null;
                }

                var values = new Dictionary<string, object>();
                if (model.Title != null)
                    values.Add("title", model.Title);
                if (model.Description != null)
                    values.Add("description", model.Description);
                if (model.Price != null)
                    values.Add("price", model.Price);
                if (model.Category != null)
                    values.Add("category", category);
                if (model.Condition != null)
                    values.Add("condition", condition);
                if (model.status != null)
                    values.Add("status", statusD[model.status]);
                if (expiry != null)
                    values.Add("expiry", expiry);

                if (values.Count != 0)
                {
                    var set = values.Keys.ToList();
                    values.Add("id", id);

                    Sql.Write($"Update Listings SET {string.Join(", ", set.Select(k => $"[{k}]=@{k}"))} " +
                                "WHERE [id]=@id;", trans, values.ToDictionary(s => "@" + s.Key, s => s.Value), 1);
                }

                if (model.Isbn != null)
                    Sql.Write(@"Update Books SET [isbn]=@isbn WHERE [list_id]=@id;", trans, new Dictionary<string, object>
                {
                    { "@isbn", isbn! },
                    { "@id", id }
                }, 1);

                var filesToDelete = new List<string>();
                if (model.Imgs != null)
                {
                    var replace = model.Imgs.Where(s => s.action == "replace").ToList();
                    var delete = model.Imgs.Where(s => s.action == "delete").Select(s => s.location).ToList();
                    var insert = model.Imgs.Where(s => s.action == "insert").ToList();
                    result = Sql.Read("SELECT id,name FROM Img WHERE list_id=@id ORDER BY id", new Dictionary<string, object>
                    {
                        { @"id", id }
                    }, trans);
                    List<long> ids = new List<long>();
                    List<string> names = new List<string>();
                    if (result.Count != 0)
                    {
                        ids = result["id"].Cast<long>().ToList();
                        names = result["name"].Cast<string>().ToList();
                    }
                    var unq = new HashSet<int>();
                    for (int i = 0; i < delete.Count; i++)
                    {
                        var loc = delete[i];
                        if (loc < 0 || loc >= ids.Count || unq.Contains(loc))
                            return BadRequest($"Invalid delete at location: {i + 1}");
                        unq.Add(loc);
                    }
                    for (int i = 0; i < replace.Count; i++)
                    {
                        var loc = replace[i].location;
                        if (loc < 0 || loc >= ids.Count || unq.Contains(loc))
                            return BadRequest($"Invalid replace at location: {i + 1}");
                        unq.Add(loc);
                    }
                    var nimgs = ids.Count - delete.Count + insert.Count;
                    if (nimgs > MaxImgCnt)
                        return BadRequest($"Only {MaxImgCnt} images are allowed.");

                    var imgn = names.ToList();

                    if (replace.Count != 0 || insert.Count != 0)
                    {
                        var im = new List<string>(replace.Count + insert.Count);
                        var ii = 0;
                        foreach(var s in replace.Concat(insert))
                        {
                            var name = SaveImage(s.ImageBase64, out error)!;
                            if (name == null) return BadRequest(new { Message = $"New Image: {ii + 1} " + error });
                            im.Add(name);
                            ii++;
                        }
                        imgReplace = im.Take(replace.Count).ToList();
                        imgInsert = im.Skip(replace.Count).ToList();
                    }

                    if (replace.Count != 0)
                    {
                        filesToDelete.AddRange(replace.Select(r => imgn[r.location]));
                        for (int i = 0; i < replace.Count; i++)
                            imgn[replace[i].location] = imgReplace![i];
                    }

                    if (delete.Count != 0)
                    {
                        filesToDelete.AddRange(delete.Select(i => imgn[i]));
                        foreach (var i in delete.OrderByDescending(i => i))
                            imgn[i] = null!;
                    }

                    if (insert.Count != 0)
                    {
                        var img2 = new List<string>();
                        var offset = 0;
                        var maxplus = Math.Max(insert.Max(s => s.location), insert.Count) + 1;
                        foreach (var i in Enumerable.Range(0, insert.Count)
                                                    .OrderBy(i => insert[i].location < 0 ? maxplus + i : insert[i].location))
                        {
                            var loc = insert[i].location;

                            if (loc >= 0 && loc < ids.Count)
                            {
                                imgn.Insert(loc + offset, imgInsert![i]);
                                offset++;
                            }
                            else
                                img2.Add(imgInsert![i]);
                        }
                        if (img2.Count != 0)
                            imgn = imgn.Concat(img2).ToList();
                    }

                    imgn.RemoveAll(s => s == null);

                    var ln = Math.Min(ids.Count, imgn.Count);
                    for (int i = 0; i < ln; i++)
                    {
                        Sql.Write("UPDATE Img SET name=@name WHERE id=@id", trans, new Dictionary<string, object>
                            {
                                { "@name", imgn[i] },
                                { "@id", ids[i] }
                            }, 1);
                    }

                    var add = imgn.Skip(Math.Min(ids.Count, imgn.Count)).ToArray();
                    if (add.Length != 0)
                    {
                        var args = Enumerable.Range(0, add.Length).ToDictionary(i => "@name" + i, i => (object)add[i]);
                        args.Add("@listid", id);
                        Sql.Write("INSERT INTO Img (list_id, name) VALUES " +
                                    string.Join(", ", Enumerable.Range(0, add.Length).Select(i => $"(@listid, @name{i})")),
                                    trans, args, add.Length);
                    }

                    var del = ids.Skip(Math.Min(imgn.Count, ids.Count)).ToArray();
                    if (del.Length != 0)
                        Sql.Write($"DELETE FROM Img WHERE id IN ({string.Join(", ", del)});", trans, null, del.Length);
                }

                trans.Commit();
                trans = null;

                filesToDelete.ForEach(DeleteImageFile);

                return Ok("Listing Updated Successfully!");
            }
            finally 
            { 
                try { trans?.Rollback(); } catch { }
                if (trans != null && imgReplace != null)
                    foreach (var im in imgReplace.Concat(imgInsert!))
                        DeleteImageFile(im);
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
                    Sql.Write("DELETE FROM Img WHERE [list_id]=@id", idd, result.Values.First().Count);

                    foreach (var img in result["name"].Cast<string>())
                        DeleteImageFile(img);
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

        public static object GetListLock(long listid)
        {
            if (listid < 0) throw new Exception("Invalid List ID.");
            object ulock;
            // Mutex lock on entire _lsLock collection
            lock (_lsLock)
            {
                // Expiry for clean up
                var expiry = DateTime.Now.AddHours(1);
                if (!_lsLock.TryGetValue(listid, out var s))
                {// If does Not have lock for userid
                    ulock = new object();                       // Create Lock object
                    _lsLock.Add(listid, (ulock, expiry));       // Add to Map
                }
                else
                {// If found
                    ulock = s.lck;                              // Get the lock object
                    _lsLock[listid] = (ulock, expiry);          // Update expiry
                }
            }

            // Return lock object
            return ulock;
        }

        /// <summary>
        /// Occasionally should be used to clean up resources.
        /// Deletes image files that no listing points to anymore (for example, when a
        /// deleted user's listings were removed along with them).
        /// </summary>
        public static void CleanUp()
        {
            var now = new Dictionary<string, object> { { "@now", Utilz.ToMtn().ToString("s") } };

            Sql.Write(@"DELETE FROM Check_Active WHERE list_id IN (
                            SELECT L.id 
                            FROM Listings L, Status S
                            WHERE S.name!='Active' AND L.status=S.id
                        )", null, -2);

            var r = Sql.Read("SELECT list_id FROM Check_Active WHERE expiry<@now;", now);
            if (r.Count != 0)
            {
                var listid = r["list_id"].Cast<long>().ToArray();
                Sql.Write($"UPDATE Listings SET status=2 WHERE id IN ({string.Join(", ", listid)});", 
                    updatedRows: listid.Length);
                Sql.Write($"DELETE FROM Check_Active WHERE list_id IN ({string.Join(", ", listid)});",
                    updatedRows: listid.Length);
            }

            // DeActivate expired listings
            Sql.Write("UPDATE Listings SET [status]=3 WHERE status=1 AND expiry<@now;",
                    now, -2);

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

            Sql.Write(@"INSERT INTO Hit_Count (list_id, count)
                        SELECT list_id, SUM(size)
                            FROM Hit_Count_Tally
                            WHERE true
                            GROUP BY list_id
                        ON CONFLICT(list_id)
                        DO UPDATE SET count = excluded.count;", null, -2);

            lock (_lsLock)
            {
                var now2 = DateTime.Now;
                foreach (var s in _lsLock.Where(s => now2 > s.Value.dt))
                    _lsLock.Remove(s.Key);
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
            result = Sql.Read("SELECT IIF([visable]=1, [id], -1) id,[name] FROM Listings_Category");
            var cats = result["name"].Cast<string>().ToList();
            cid = result["id"].Cast<long>().ToList();
            match = cats.FirstOrDefault(c =>
                string.Equals(c, m.Category?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (match == null)
                return $"Category must be one of: {string.Join(", ", conds)}.";
            category = cid[cats.IndexOf(match)];
            if (category < 0)
                return $"Category is no longer used: {match}.";

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
                if (m.ImageBase64.Length > MaxImgCnt)
                    return $"There can be no more than {MaxImgCnt} images.";
                imgs = m.ImageBase64.Where(m => !string.IsNullOrWhiteSpace(m)).ToArray();
                if (imgs.Length == 0)
                    imgs = null;
            }

            return null;
        }

        public static void IncHitCount(long listid, long ip, int size)
        {
            if (listid < 0) throw new ArgumentOutOfRangeException("listid < 0");
            if (ip < 0) throw new ArgumentOutOfRangeException("ip < 0");
            if (size <= 0) throw new ArgumentOutOfRangeException("size <= 0");
            var d = new Dictionary<string, object> 
            { 
                { "@list_id", listid },
                { "@ip", ip },
                { "@size", size }
            };

            Sql.Write(@"INSERT INTO Hit_Count_Tally (list_id, ip, size)
                        VALUES (@list_id, @ip, @size)
                        ON CONFLICT(list_id, ip) 
                        DO UPDATE SET size = excluded.size
                        WHERE excluded.size > Hit_Count_Tally.size;", d, -2);
        }

        static void MakeSureActive(long listid)
        {
            var d = new Dictionary<string, object> { { "@id", listid } };
            var result = Sql.Read("SELECT list_id FROM Check_Active WHERE list_id=@id;", d);

            if (result.Count != 0) return;
             
            d.Add("@expiry", (Utilz.ToMtn() + Env._inActiveExpiry).ToString("s"));
            Sql.Write("INSERT INTO Check_Active (list_id, expiry) VALUES (@id, @expiry);", d, 1);
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
            string? name = null;
            for (int i = 0; i < 3; i++)
            {
                name = Guid.NewGuid().ToString("N") + ext;
                if (!System.IO.File.Exists(Path.Combine(UploadsPath, name)))
                    break;
                else
                    name = null;
            }
            if (name == null) throw new Exception("name == null"); 
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

        public class Update : AppAuthJson
        {
            public string? Title { get; set; }
            public string? Description { get; set; }
            public decimal? Price { get; set; }
            public string? Category { get; set; }
            public string? Condition { get; set; }
            public string? Isbn { get; set; }   // optional, textbooks only
            public string? status { get; set; }
            public Img[]? Imgs { get; set; }    // optional
        }

        public class Img
        {
            public string ImageBase64 { get; set; } = string.Empty;
            public int location { get; set; }
            public string action { get; set; } = string.Empty; // insert, delete, or replace
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