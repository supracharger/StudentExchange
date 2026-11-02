using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace StudentExchangeBck{
    [ApiController]
    [Route("[controller]")]
    public class Register : ControllerBase{
        [HttpPost]
        public IActionResult Post(Info request){//create an account
            // Validate Application Access
            var msg = AppAuthJson.ValidateApp(request, HttpContext, this, out var ip);
            // Exit if no auth
            if (msg != null) return msg;

            if (request.user != null)
                return BadRequest("User cannot be set yet.");
            if (request.location != null)
                return BadRequest("Location cannot be set yet.");

            try
            {
                // Validate fields
                var error = ValidateFormatInfo(ref request, out var schoolId, out var emailCrypt, out var passCrypt,
                                                finduser: true);
                if (error != null) return BadRequest(new
                {
                    Message = error
                });

                try
                {
                    // Insert user into db
                    Sql.Write(@"INSERT INTO User ([email],[user_name],[first_name],[last_name],[password],[school_id],[datetime])
                            VALUES (@email,@user,@first_name,@last_name,@password,@school_id,@datetime)",
                            new Dictionary<string, object>
                            {
                                {"@email", emailCrypt},
                                {"@user", request.user! },
                                {"@first_name", request.first_name!},
                                {"@last_name", request.last_name!},
                                {"@password", passCrypt},
                                {"@school_id", schoolId},
                                {"@datetime", Utilz.ToMtn().ToString("s")},
                            }, 1);
                }
                catch (Microsoft.Data.Sqlite.SqliteException e)
                {
                    // Email that is already in the database
                    if (e.Message.Contains("UNIQUE constraint failed: User.email"))
                        return Conflict("A user with that email already exists.");

                    throw;
                }

                // Success
                return StatusCode(201, new
                {
                    Message = "User added.",
                    Email = request.email
                });
            }
            catch (ArgumentException e)
            {
                return BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                return StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }

        [HttpGet]
        public IActionResult Get(AppAuthJson request){//view users register info
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, request, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            if (user.forwarded && user.adminLvl < 10)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                // Not Authorized, Admin level too low
                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // Get Registered info from db
                var result = Sql.Read(@"SELECT [email],user_name user,[first_name],[last_name],S.[name] school,
                                        U.location
                                        FROM User U, Schools S
                                        WHERE U.[id]=@id AND
                                        U.[school_id]=S.[id]",
                                        new Dictionary<string, object>
                                        {
                                            {"@id", user.id },
                                        });
                if (result.Count == 0)
                    throw new Exception("There should have been a result for this user id, but there was none?");

                return Ok(new
                {
                    email = DeterministicEncryption.Decrypt((string)result["email"][0], Env._emailSalt),
                    user = result["user"][0],
                    first_name = result["first_name"][0],
                    last_name = result["last_name"][0],
                    school = result["school"][0],
                    location = Val(result["location"][0])
                });
            }
            catch (ArgumentException e)
            {
                return BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                return StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }

        [HttpPatch]
        public IActionResult Patch(Info info){//update some of a user's info
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            if (user.forwarded && user.adminLvl < 10)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                // Not Authorized, Admin level too low
                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // columns to update
                var updateKeys = "email first_name last_name password school user_name location".Split().ToHashSet();
                // Max Count
                var cnt = updateKeys.Count;
                // colums that need db data
                var nullKeys = new HashSet<string>(cnt);

                // If null or whitespace: set to null & add to null keys
                if (string.IsNullOrWhiteSpace(info.email))
                { info.email = null; nullKeys.Add("email"); }
                if (string.IsNullOrWhiteSpace(info.first_name))
                { info.first_name = null; nullKeys.Add("first_name"); }
                if (string.IsNullOrWhiteSpace(info.last_name))
                { info.last_name = null; nullKeys.Add("last_name"); }
                if (string.IsNullOrWhiteSpace(info.password))
                { info.password = null; nullKeys.Add("password"); }
                if (string.IsNullOrWhiteSpace(info.school))
                { info.school = null; nullKeys.Add("school"); }
                if (string.IsNullOrWhiteSpace(info.user))
                { info.user = null; nullKeys.Add("user_name"); }
                if (string.IsNullOrWhiteSpace(info.location))
                { info.location = null; nullKeys.Add("location"); }
                // Remove null keys from updated keys
                foreach (var k in nullKeys)
                    if (!updateKeys.Remove(k))
                        throw new Exception($"'nullkeys' has an extra key: {k}");

                // Validation
                if (nullKeys.Count > cnt) throw new Exception("nullKeys.Count > cnt");
                if (updateKeys.Count == 0)
                    return BadRequest("There is nothing to update.");

                // If need to fill in data from db
                if (nullKeys.Count != 0)
                {
                    // Get the data to fill in
                    var col = nullKeys.Select(k => $"[{k}]").ToHashSet();
                    if (col.Remove("[school]"))
                        col.Add("S.[name] school");
                    col.Add("[user_name]");
                    var result = Sql.Read($"SELECT {string.Join(',', col)} " +
                                            @"FROM User U, Schools S
                                            WHERE U.[id]=@id AND
                                            U.[school_id]=S.[id]",
                                            new Dictionary<string, object>
                                            {
                                                {"@id", user.id },
                                            });
                    if (result.Count == 0)
                        throw new Exception("There should have been a result for this user id, but there was none?");

                    // Fill in the data
                    if (info.email == null)
                        info.email = DeterministicEncryption.Decrypt((string)result["email"][0], Env._emailSalt);
                    if (info.first_name == null)
                        info.first_name = (string)result["first_name"][0];
                    if (info.last_name == null)
                        info.last_name = (string)result["last_name"][0];
                    if (info.password == null)
                        info.password = DeterministicEncryption.Decrypt((string)result["password"][0], Env._passSalt);
                    if (info.school == null)
                        info.school = (string)result["school"][0];
                    if (info.user != null && info.user == (string)result["user_name"][0])
                    {
                        info.user = null;
                        updateKeys.Remove("user_name");
                    }
                    //if (info.user == null)
                    //    info.user = (string)result["user_name"][0];
                    if (info.location == null)
                    {
                        var loc = Val(result["location"][0]);
                        info.location = loc != null ? (string)loc : null;
                    }
                }

                // Validate the updated data
                var error = ValidateFormatInfo(ref info, out var schoolId, out var emailCrypt, out var passCrypt);
                if (error != null) return BadRequest(new
                {
                    Message = error
                });

                // Find what needs to be updated in db
                var update = new Dictionary<string, object>(updateKeys.Count);
                if (updateKeys.Contains("email"))
                    update.Add("email", emailCrypt);
                if (updateKeys.Contains("first_name"))
                    update.Add("first_name", info.first_name!);
                if (updateKeys.Contains("last_name"))
                    update.Add("last_name", info.last_name!);
                if (updateKeys.Contains("password"))
                    update.Add("password", passCrypt);
                if (updateKeys.Contains("school"))
                    update.Add("school_id", schoolId);
                if (updateKeys.Contains("user_name"))
                    update.Add("user_name", info.user!);
                if (updateKeys.Contains("location"))
                    update.Add("location", info.location!);

                try
                {
                    var ku = update.Keys.ToList();
                    update.Add("id", user.id);
                    // Add updated info to database
                    Sql.Write($"UPDATE User SET {string.Join(", ", ku.Select(k => $"[{k}]=@{k}"))} " +
                                "WHERE [id]=@id", update.ToDictionary(s => "@" + s.Key, s => s.Value), 1);
                }
                catch (Microsoft.Data.Sqlite.SqliteException e)
                {
                    // Email that is already in the database
                    if (e.Message.Contains("UNIQUE constraint failed: User.email"))
                        return Conflict("A user with that email already exists.");

                    throw;
                }

                // Success
                return Ok(new
                {
                    Message = $"Successfully updated: {string.Join(", ", updateKeys)}.",
                    email = info.email
                });
            }
            catch (ArgumentException e)
            {
                return BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                return StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }

        [HttpDelete]
        public IActionResult Delete(AppAuthJson auth){//delete user ADMIN ONLY
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Not Authorized: Admin level too low
            if (user.adminLvl < 10)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            }

            // Not Authorized: User needs to be forwarded
            if (!user.forwarded)
                return new BadRequestObjectResult(new
                {
                    Message = "User needs to be forwarded."
                });

            try
            {
                // Delete user from DB
                var cnt = Sql.Write("DELETE FROM User WHERE [id]=@id;", new Dictionary<string, object>
                {
                    { "@id", user.id }
                }, 1);
                // Nothing in table
                if (cnt == 0)
                    throw new ArgumentException("Unknown email: not found in data base.");

                // Success
                return Ok(new
                {
                    Message = "Successfully deleted user.",
                    Email = auth.to_user,
                    Deleted_Rows = cnt
                });
            }
            catch (ArgumentException e)
            {
                return BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                return StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }

        // Valid Regex Email
        static readonly Regex _valEmail = new Regex(@"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$");
        // Valid Regex Name
        static readonly Regex _valName = new Regex(@"^[A-Z][a-z]*( [A-Z][a-z]*)*$");
        // has Upper case
        static readonly Regex _hasUpper = new Regex(@"[A-Z]+");
        // has Symbol
        static readonly Regex _hasSymbol = new Regex(@"[!@#$%^&*_\-+=]"); 
        // Valid Regex Password
        static readonly Regex _valPass = new Regex(@"^[a-zA-Z0-9!@#$%^&*_\-+=]+$");
        static readonly Regex _valUser = new Regex(@"^[a-z0-9_\-]{2,}$");

        static string? ValidateFormatInfo(ref Info info, out object schoolID, out string emailCrypt, out string passCrypt,
                                        bool finduser = false){//helper that both Post and Patch use. takes the Info object by ref, its the rulebook
            schoolID = null!;
            emailCrypt = null!;
            passCrypt = null!;
            
            // Check for null or whitespace
            if (string.IsNullOrWhiteSpace(info.email))
                return "There needs to be an Email.";
            if (string.IsNullOrWhiteSpace(info.first_name))
                return "There needs to be an First Name.";
            if (string.IsNullOrWhiteSpace(info.last_name))
                return "There needs to be an Last Name.";
            if (string.IsNullOrWhiteSpace(info.password))
                return "There needs to be an Password.";
            if (string.IsNullOrWhiteSpace(info.school))
                return "There needs to be an School.";

            // Format
            info.email = info.email.Trim().ToLower();
            info.first_name = Utilz.FirstUpper(info.first_name.Trim());
            info.last_name = Utilz.FirstUpper(info.last_name.Trim());
            info.password = info.password.Trim();
            info.school = info.school.Trim();

            // Validate Email
            if (info.email.Length > 50)
                return "Email must be <=50 characters.";
            if (!_valEmail.IsMatch(info.email))
                return "Email is not in the correct format.";
            if (!_valName.IsMatch(info.first_name))
                return "First name is not in the correct format.";
            if (!_valName.IsMatch(info.last_name))
                return "Last name is not in the correct format.";

            // Validate Password
            if (info.password.Length < 8)
                return "Password needs to be at least 8+ characters.";
            if (info.password.Length > 50)
                return "Password must be <=50 characters.";
            if (!_hasUpper.IsMatch(info.password))
                return "Password must have at least 1+ uppercase character.";
            if (!_hasSymbol.IsMatch(info.password))
                return "Password must have at least 1+ symbol: '!@#$%^&*_-+='.";
            if (!_valPass.IsMatch(info.password))
                return "Password is invalid.";

            // Find school_id for 'school'
            var result = Sql.Read("SELECT id FROM Schools WHERE [name]=@name",
                            new Dictionary<string, object> { { "@name", info.school } });
            if (result.Count == 0)
                return $"This school is not found in the data base: '{info.school}'.";
            schoolID = result["id"][0];

            if (info.user == null && finduser)
                info.user = Users.FindUniqueUser(info.first_name, info.last_name);
            else if (info.user != null)
            {
                if (string.IsNullOrWhiteSpace(info.user))
                    return "User needs to be specified.";
                var user = info.user;
                var match = Users.FindUniqueUser(ref user);
                info.user = user;
                if (match != info.user)
                    return $"There is already a username linked to the account. Try: '{match}'";
                if (!_valUser.IsMatch(info.user))
                    return "User allows characters alphanumeric and '-_'.";
            }

            if (string.IsNullOrWhiteSpace(info.location))
                info.location = null;
            else
                info.location = string.Join(' ', info.location.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));

                // Encrypted in db
                emailCrypt = DeterministicEncryption.Encrypt(info.email, Env._emailSalt);
            passCrypt = DeterministicEncryption.Encrypt(info.password, Env._passSalt);

            return null;
        }

        // The database gives DBNull for empty cells; turn that into a normal null
        static object? Val(object o) => o is DBNull ? null : o;

        public class Info : AppAuthJson{
            public string? email { get; set; }
            public string? first_name { get; set; }
            public string? last_name { get; set; }
            public string? password { get; set; }
            public string? school { get; set; }

            public string? user { get; set; }
            public string? location { get; set; }
        }
    }
}