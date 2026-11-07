using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck{
    public static class IP{
        /// Locks based on IP Address.
        /// To keep Atomic nature usually imbetween sql calls
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

        public static IActionResult? UpdateByIP(string? clientip, ControllerBase this_, out long ipid){//take caller IP address, encrypt, look up in IP table, return ID
            ipid = -1;

            try{
                // Get IP Address
                if (string.IsNullOrWhiteSpace(clientip)) return null;
                // Encrypt IP Address
                clientip = DeterministicEncryption.Encrypt(clientip, Env._ipSalt);

                // Check if IP is in DB else Add it
                Dictionary<string, List<object>> result = null!;
                for (int i = 0; i < 2; i++){
                    //get info for db
                    result = Sql.Read("SELECT [id],[datetime] FROM IP WHERE [ip]=@ip", new Dictionary<string, object>
                    {
                        { "@ip", clientip }
                    });

                    //has info no need to add
                    if (result.Count != 0) break;

                    //add info not in db
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

                if ((Utilz.ToMtn() - dt).TotalHours >= 1){// Update on an hourly basis when last accessed
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

        public static void TrackIPToUser(in long ip, in long user){//checks whether IP pair already exists in User_Has_IPs adds if not
            //validate
            if (ip < 0) throw new ArgumentOutOfRangeException("ip < 0");
            if (user < 0) throw new ArgumentOutOfRangeException("user < 0");

            lock (GetIPLock(ip))
            {
                //look for Unique user_id, ip_id pairs
                var result = Sql.Read("SELECT [user_id] FROM User_Has_IPs WHERE [user_id]=@userid AND [ip_id]=@ip",
                    new Dictionary<string, object>
                    {
                    { "@userid", user },
                    { "@ip", ip }
                    });

                //exit: already has relationship
                if (result.Count != 0) return;

                //add Relationship
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
        public static IActionResult? IncInvalidForIP(bool increment, ControllerBase this_, object ipid){//called with increment:true after a bad attempt or false to check if IP already blocked
            //mutex lock on each IP Address
            lock (GetIPLock((long)ipid))
            {
                //try to find row for an lately invalid access attemps that have not expired.
                var args = new Dictionary<string, object>
                {
                    { "@ipid", ipid }
                };
                // Try to find row for an lately invalid access attemps that have not expired.
                var result = Sql.Read(@"SELECT [id],[count],[expiry] FROM Blocked_IPs
                                        WHERE [ip_id]=@ipid", args);
                var found = result.Count != 0;
                var count = found ? (long)result["count"][0] : (increment ? 0 : -1);
                var expiry = found ? (string)result["expiry"][0] : null;
                var expired = expiry != null && DateTime.Parse(expiry) <= Utilz.ToMtn();
                if (expired)
                {
                    expiry = null;
                    count = !increment ? -1 : 0;
                }

                if (!found || increment || expired)
                {
                    if (increment) count = Math.Max(count, 0) + 1;
                    if (expiry == null)
                        expiry = (Utilz.ToMtn() + Env._blockedAccessTimeOutIP).ToString("s");
                    var inc = (!increment && (result.Count == 0 || expired)) ? -1 : 1;
                    if (!expired && count % Env._accessAttempsIP == 0 && count > Env._accessAttempsIP)
                    {// If gone to next section: increase timeout more.
                        // Exponential increase: if continueing to access
                        var wait = Env._blockedAccessTimeOutIP * Math.Max(count / Env._accessAttempsIP - 2, 1);
                        // Increase timeout
                        var expVal = DateTime.Parse(expiry!);
                        var now = Utilz.ToMtn();
                        expiry = ((expVal > now ? expVal : now) + wait).ToString("s");
                    }
                    Sql.Write(@"INSERT INTO Blocked_IPs ([ip_id],[count],[expiry]) VALUES
                                (@ipid,@inc,@expiry)
                                ON CONFLICT (ip_id)
                                DO UPDATE SET count = IIF(@inc >= 0 AND @expired==0, MAX(count, 0) + @inc, @inc),
                                expiry=@expiry;", new Dictionary<string, object>
                                {
                                    { "@ipid", ipid },
                                    { "@inc", inc },
                                    { "@expiry", expiry },
                                    { "@expired", expired ? 1 : 0 }
                                }, 1);
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

        public static object GetIPLock(long ipid){//two requests from the same IP might run at the same moment, both could read and write losing an update so each P gets its own lock object
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
        public static void CleanUp(){//delete old data thats no longer needed
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
            public readonly long sudo_id = -1;
            public bool forwarded;

            public Data(long id, bool forwarded = false, long sudo_id = -1)
            {
                this.id = id;
                this.sudo_id = sudo_id;
                this.forwarded = forwarded;
            }
        }
    }
}