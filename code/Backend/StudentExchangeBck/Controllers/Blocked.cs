using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

/* Blocked Users & IP
 
   GET Get():
        Get Blocked Users & IPs
        Input: {app_access, access_token}
        Output: On Success {blockedUsers: [], blockedIPs: []}

   DELETE Delete():
        Delete Blocked User or IP
        Input: {app_access, access_token, email || ip_addr}
        Output: On Success {Message, Email || IP, Deleted_Rows}
 */

namespace StudentExchangeBck
{
    [ApiController]
    [Route("[controller]")]
    public class Blocked : ControllerBase
    {
        /// <summary>
        /// Get Blocked Users & IPs
        /// </summary>
        /// <param name="auth">Input: {app_access, access_token}</param>
        /// <returns>Output: On Success {blockedUsers: [], blockedIPs: []}</returns>
        [HttpGet]
        public IActionResult Get(AppAuthJson auth)
        {
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Not Authorized: User can't be forwarded
            if (user.forwarded)
                return Unauthorized(new
                {
                    Message = "User cannot be forwarded."
                });

            // Not Authorized: Not Admin or Admin level too low
            if (!user.isAdmin || user.adminLvl < 20)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                return Unauthorized(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // Get Blocked users info from DB
                var bldUsers = Sql.Read("SELECT (U.[last_name] || ', ' || U.[first_name]) name, " +
                                        "U.[email], B.[expiry], B.[count] " +
                                        "FROM Blocked_Users B, User U " +
                                        "WHERE B.[user_id]=U.[id] AND " +
                                        "B.[expiry]>@now " +
                                        "ORDER BY B.[expiry] DESC, name;", new Dictionary<string, object>
                                        {
                                            { "@now", Utilz.ToMtn().ToString("s") }
                                        });

                // Get Blocked IP info from DB
                var bldIP = Sql.Read("SELECT P.[ip], (U.[last_name] || ', ' || U.[first_name]) name, " +
                                    "U.[email], B.[expiry], B.[count], P.[id] ipid " +
                                    "FROM Blocked_Ips B, IP P, User_Has_IPs H, User U " +
                                    "WHERE B.[ip_id]=H.[ip_id] AND U.[id]=H.[user_id] AND P.[id]=B.[ip_id] AND " +
                                    "B.[expiry]>@now " +
                                    "ORDER BY B.[expiry] DESC, name;", new Dictionary<string, object>
                                    {
                                        { "@now", Utilz.ToMtn().ToString("s") }
                                    });

                var fromCrypt = new Dictionary<string, object>();

                // Format Rows of Columns
                Func<Dictionary<string, List<object>>, List<Dictionary<string, object?>>> Format = b =>
                {
                    var blk = new List<Dictionary<string, object?>>();
                    // Exit: nothing
                    if (b.Count == 0) return blk;

                    // Decrypt email cached
                    b["email"] = b["email"].Select(e =>
                    {
                        var s = (string)e;
                        if (fromCrypt.TryGetValue(s, out var dcy))
                            return dcy;
                        dcy = (object)DeterministicEncryption.Decrypt((string)e, Env._emailSalt);
                        fromCrypt.Add(s, dcy);
                        return dcy;
                    }).ToList();

                    // Get Rows of Columns
                    var keys = b.Keys.ToList();
                    var dta = Utilz.Transpose(keys.Select(k => b[k]).ToList()).ToList();

                    // Create List of Dictionary key value pairs
                    foreach(var row in dta)
                    {
                        var d = new Dictionary<string, object?>();
                        blk.Add(d);
                        for (int i = 0; i < keys.Count; i++)
                            d.Add(keys[i], row[i]);
                    }

                    return blk;
                };

                var bkIPs = Format(bldIP);

                // Get users inside of IP Row
                var bkip = new Dictionary<long, object>();
                // User cells
                var userdta = new[] { "name", "email" };
                // Loop joined ip & users
                foreach(var p in bkIPs)
                {
                    // IP
                    var ipid = (long)p["ipid"]!;
                    // Get User data
                    var usr = new Dictionary<string, object>();
                    foreach (var k in userdta)
                        usr.Add(k, p[k]!);
                    // If same ip
                    if (bkip.TryGetValue(ipid, out var row_))
                    {
                        // Add user
                        var users = (List<Dictionary<string, object>>)((Dictionary<string, object?>)row_)["users"]!;
                        users.Add(usr);
                    }
                    // if new ip
                    else
                    {
                        // IP Row without user data
                        var d2 = p.ToDictionary(s => s.Key, s => s.Value);
                        foreach (var k in userdta)
                            d2.Remove(k);
                        if (d2.ContainsKey("ipid"))
                            d2.Remove("ipid");
                        d2["ip"] = DeterministicEncryption.Decrypt((string)d2["ip"]!, Env._ipSalt);
                        // Add user data
                        d2.Add("users", new List<Dictionary<string, object>> { usr });
                        // Add to map
                        bkip.Add(ipid, d2);
                    }
                    
                }

                var bkIPs2 = bkip.Values.ToList();

                // Sort users by name
                foreach(var b in bkIPs2)
                {
                    var dd = (Dictionary<string, object?>)b;
                    dd["users"] = ((List<Dictionary<string, object>>)dd["users"]!).OrderBy(s => (string)s["name"]).ToList();
                }

                // Success
                return Ok(new
                {
                    blockedUsers = Format(bldUsers),
                    blockedIPs = bkIPs2
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

        /// <summary>
        /// Delete Blocked User or IP
        /// </summary>
        /// <param name="info">Input: {app_access, access_token, email || ip_addr}</param>
        /// <returns>Output: On Success {Message, Email || IP, Deleted_Rows}</returns>
        [HttpDelete]
        public IActionResult Delete(Info info)
        {
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Not Authorized: User can't be forwarded
            if (user.forwarded)
                return BadRequest(new
                {
                    Message = "User cannot be forwarded."
                });

            // Not Authorized: Not Admin or Admin level too low
            if (!user.isAdmin || user.adminLvl < 20)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                return Unauthorized(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // If has value
                var hasEmail = !string.IsNullOrWhiteSpace(info.email);
                var hasIP = !string.IsNullOrWhiteSpace(info.ip_addr);

                // If both blank
                if (!hasEmail && !hasIP)
                    throw new ArgumentException("You need to specify and email or ip_addr.");
                // If both have the same flag
                if (hasEmail == hasIP)
                    throw new ArgumentException("You cannot specify both email and ip_addr.");

                // Delete blocked user
                if (hasEmail)
                {
                    // Get user id
                    var result = Sql.Read("SELECT [id] FROM User WHERE [email]=@email;", new Dictionary<string, object>
                    {
                        { "@email", DeterministicEncryption.Encrypt(info.email!, Env._emailSalt) }
                    });
                    // Unknown
                    if (result.Count == 0)
                        throw new ArgumentException("Unknown email: " + info.email);

                    // Make user no longer blocked
                    var cnt = Sql.Write("DELETE FROM Blocked_Users WHERE [user_id]=@userid;", new Dictionary<string, object>
                    {
                        { "@userid", result["id"][0] }
                    }, -2);
                    // Nothing in table
                    if (cnt == 0)
                        throw new ArgumentException("That email is not blocked.");

                    // Success
                    return Ok(new
                    {
                        Message = "Successfully unblocked user.",
                        Email = info.email,
                        Deleted_Rows = cnt
                    });
                }

                // Delete blocked ip
                if (hasIP)
                {
                    // Find ip id
                    var result = Sql.Read("SELECT [id] FROM IP WHERE [ip]=@ip;", new Dictionary<string, object>
                    {
                        { "@ip", DeterministicEncryption.Encrypt(info.ip_addr!, Env._ipSalt) }
                    });
                    // Unknown
                    if (result.Count == 0)
                        throw new ArgumentException("Unknown IP Address: " + info.ip_addr);

                    // Delete blocked ip
                    var cnt = Sql.Write("DELETE FROM Blocked_IPs WHERE [ip_id]=@ipid;", new Dictionary<string, object>
                    {
                        { "@ipid", result["id"][0] }
                    }, -2);
                    // Nothing in table
                    if (cnt == 0)
                        throw new ArgumentException("That IP Address is not blocked.");

                    // Success
                    return Ok(new
                    {
                        Message = "Successfully unblocked IP Address.",
                        IP = info.ip_addr,
                        Deleted_Rows = cnt
                    });
                }

                throw new Exception("Function should have exited before here.");
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

        public class Info : AppAuthJson
        {
            public string? email { get; set; }
            public string? ip_addr { get; set; }
        }
    }
}
