using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck
{
    public static class IP
    {
        /// <summary>
        /// Locks based on IP Address.
        /// To keep Atomic nature usually imbetween sql calls
        /// </summary>
        static readonly Dictionary<long, (object lck, DateTime dt)> _ipLock
            = new Dictionary<long, (object, DateTime)>();

        /// <summary>
        /// Add Check IP Address is in db
        /// </summary>
        /// <param name="ctx">context to get IP Address</param>
        /// <param name="this_">Countroller Base</param>
        /// <param name="ipid">Returned IP Address ID</param>
        /// <returns>Message to client</returns>
        public static IActionResult? UpdateByIP(HttpContext ctx, ControllerBase this_, out long ipid)
            => UpdateByIP(ctx.Connection.RemoteIpAddress?.ToString(), this_, out ipid);

        /// <summary>
        /// Add Check IP Address is in db
        /// </summary>
        /// <param name="clientip">IP Address</param>
        /// <param name="this_">Countroller Base</param>
        /// <param name="ipid">Returned IP Address ID</param>
        /// <returns>Message to client</returns>
        public static IActionResult? UpdateByIP(string? clientip, ControllerBase this_, out long ipid)
        {
            ipid = -1;

            try
            {
                // Get IP Address
                if (string.IsNullOrWhiteSpace(clientip)) return null;
                // Encrypt IP Address
                clientip = DeterministicEncryption.Encrypt(clientip, Env._ipSalt);

                // Check if IP is in DB else Add it
                Dictionary<string, List<object>> result = null!;
                for (int i = 0; i < 2; i++)
                {
                    // Get info for IP
                    result = Sql.Read("SELECT [id],[datetime] FROM IP WHERE [ip]=@ip", new Dictionary<string, object>
                    {
                        { "@ip", clientip }
                    });

                    // Has info, no need to add
                    if (result.Count != 0) break;

                    // Add info, not currently in DB
                    Sql.Write("INSERT INTO IP ([ip], [datetime]) VALUES (@ip, @datetime)", new Dictionary<string, object>
                    {
                        { "@ip", clientip },
                        { "@datetime", Utilz.ToMtn().ToString("s") }
                    }, 1);
                }

                // Internal error: Should have IP info
                if (result.Count == 0) throw new Exception("There should have been a ip_id.");

                // Info
                ipid = (long)result["id"][0];
                var dt = DateTime.Parse((string)result["datetime"][0]);

                // Update on an hourly basis when last accessed
                if ((Utilz.ToMtn() - dt).TotalHours >= 1)
                {
                    lock (GetIPLock(ipid))
                    {
                        Sql.Write("UPDATE IP SET [datetime]=@dt WHERE [id]=@id", new Dictionary<string, object>
                        {
                            { "@dt", Utilz.ToMtn().ToString("s") },
                            { "@id", ipid }
                        }, 1);
                    }
                }

                // Success
                return null;
            }
            catch (ArgumentException e)
            {
                return this_.BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                return this_.StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }

        /// <summary>
        /// Tracks Users to IP Addresses
        /// </summary>
        /// <param name="ip">IP Address ID</param>
        /// <param name="user">User ID</param>
        /// <exception cref="ArgumentOutOfRangeException"></exception>
        public static void TrackIPToUser(in long ip, in long user)
        {
            // Validate
            if (ip < 0) throw new ArgumentOutOfRangeException("ip < 0");
            if (user < 0) throw new ArgumentOutOfRangeException("user < 0");

            lock (GetIPLock(ip))
            {
                // Look for Unique user_id, ip_id pairs
                var result = Sql.Read("SELECT [user_id] FROM User_Has_IPs WHERE [user_id]=@userid AND [ip_id]=@ip",
                    new Dictionary<string, object>
                    {
                    { "@userid", user },
                    { "@ip", ip }
                    });

                // Exit: Already has relationship
                if (result.Count != 0) return;

                // Add Relationship
                Sql.Write("INSERT INTO User_Has_IPs ([user_id],[ip_id]) VALUES (@userid,@ip)",
                    new Dictionary<string, object>
                    {
                    { "@userid", user },
                    { "@ip", ip }
                    }, 1);
            }
        }

        /// <summary>
        /// Checks for to many access attemps to a user. 
        /// Will block user for a timeout of too many invalid access attemps.
        /// </summary>
        /// <param name="increment">true: increment invalid access attemps, false: just check if it needs to block.</param>
        /// <param name="this_">Controller Base</param>
        /// <param name="userid_">(long) user id</param>
        /// <returns>If ok: null else NoAuth.</returns>
        public static IActionResult? IncInvalidForIP(bool increment, ControllerBase this_, object ipid)
        {
            // Mutex lock on each IP Address
            lock (GetIPLock((long)ipid))
            {
                // Try to find row for an lately invalid access attemps that have not expired.
                var result = Sql.Read("SELECT [id],[count],[expiry] FROM Blocked_IPs " +
                                        "WHERE [ip_id]=@ipid AND [expiry]>@date",
                                        new Dictionary<string, object>
                                        {
                                            { "@ipid", ipid },
                                            { "@date", Utilz.ToMtn().ToString("s") }
                                        });

                // If no invalid access attemps lately
                if (result.Count == 0)
                {
                    // If you want to increment invalid access attemps
                    if (increment)
                    {
                        // Insert row of first invalid access attempt.
                        Sql.Write("INSERT INTO Blocked_IPs ([ip_id],[count],[expiry]) VALUES " +
                                    "(@ipid,@count,@expiry)", new Dictionary<string, object>
                                    {
                                    {"@ipid", ipid },
                                    {"@count", 1 },
                                    {"@expiry", Utilz.ToMtn().Add(Env._blockedAccessTimeOutIP).ToString("s")}
                                    }, 1);
                    }

                    // EXIT
                    return null;
                }

                // Has invalid access attemps lately
                // Get id, count, & expiry
                var id = result["id"][0];
                var count = (long)result["count"][0];
                var expiry = DateTime.Parse((string)result["expiry"][0]);

                // If you want to increment invalid access attemps
                if (increment || count >= Env._accessAttempsIP)
                {
                    count++;            // increment invalid access attempts
                    // columns to update
                    var update = new Dictionary<string, object> { { "count", count } };

                    // If gone to next section: increase timeout more.
                    if (count % Env._accessAttempsIP == 0 && count > Env._accessAttempsIP)
                    {
                        // Exponential increase: if continueing to access
                        var wait = Env._blockedAccessTimeOutIP * Math.Max(count / Env._accessAttempsIP - 2, 1);
                        // Increase timeout
                        expiry = new[] { expiry, Utilz.ToMtn() }.Max() + wait;
                        // Be sure to update it in sql
                        update.Add("expiry", expiry.ToString("s"));
                    }

                    // Update the invalid Access IP table
                    var ku = update.Keys.ToList();
                    update.Add("id", id);
                    Sql.Write($"UPDATE Blocked_IPs SET {string.Join(", ", ku.Select(k => $"[{k}]=@{k}"))} " +
                                "WHERE [id]=@id", update.ToDictionary(s => "@" + s.Key, s => s.Value), 1);
                }

                // User is blocked: too many invalid access attempts
                if (count >= Env._accessAttempsIP)
                    return this_.BadRequest(new
                    {
                        Message = $"You are now blocked from access till {expiry} Mountain Standard Time."
                    });

                // User is ok
                return null;
            }
        }

        /// <summary>
        /// Gets the mutex lock for each IP id
        /// </summary>
        /// <param name="userid">IP id to get the lock</param>
        /// <returns>lock object</returns>
        public static object GetIPLock(long ipid)
        {
            if (ipid < 0) throw new Exception("Invalid IP ID.");
            object ulock;
            // Mutex lock on entire _ipLock collection
            lock (_ipLock)
            {
                // Expiry for clean up
                var expiry = DateTime.Now.AddHours(1);
                // If does Not have lock for ipid
                if (!_ipLock.TryGetValue(ipid, out var s))
                {
                    ulock = new object();                   // Create Lock object
                    _ipLock.Add(ipid, (ulock, expiry));     // Add to Map
                }
                // If found
                else
                {
                    ulock = s.lck;                          // Get the lock object
                    _ipLock[ipid] = (ulock, expiry);        // Update expiry
                }
            }

            // Return lock object
            return ulock;
        }

        /// <summary>
        /// Occasionally should be used to clean up resources
        /// </summary>
        public static void CleanUp()
        {
            // Clean up invalid accesses that have expired
            Sql.Write("DELETE FROM Blocked_IPs WHERE [expiry]<@date", new Dictionary<string, object>
            {
                {"@date", Utilz.ToMtn().ToString("s") }
            }, -2);

            // Clean up expired user mutex locks
            lock (_ipLock)
            {
                var now = DateTime.Now;
                foreach (var s in _ipLock.Where(s => now > s.Value.dt))
                    _ipLock.Remove(s.Key);
            }
        }

        public struct Data
        {
            public readonly long id = -1;
            public bool forwarded;

            public Data(long id, bool forwarded = false)
            {
                this.id = id;
                this.forwarded = forwarded;
            }
        }
    }
}
