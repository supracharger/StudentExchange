using Microsoft.AspNetCore.Mvc;

/* Users:
   IncInvalidForUser_Email():
   IncInvalidForUser_Token():
   IncInvalidForUser():
        Checks for too many access attemps to a user. 
        Will block user for a timeout of too many invalid access attemps.

   GetUserLock():
        Gets the mutex lock for each user id

   CleanUp():
        Occasionally should be used to clean up resources
 */

namespace StudentExchangeBck
{
    public class Users
    {
        /// <summary>
        /// Locks based on userid.
        /// To keep Atomic nature usually imbetween sql calls
        /// </summary>
        static readonly Dictionary<long, (object lck, DateTime dt)> _userLock
            = new Dictionary<long, (object, DateTime)>();

        /// <summary>
        /// Checks for to many access attemps to a user. 
        /// Will block user for a timeout of too many invalid access attemps.
        /// </summary>
        /// <param name="increment">true: increment invalid access attemps, false: just check if it needs to block.</param>
        /// <param name="this_">Controller Base</param>
        /// <param name="emailCrypt">Encrypted Email</param>
        /// <returns>If ok || email not found: null else NoAuth.</returns>
        public static IActionResult? IncInvalidForUser_Email(bool increment, ControllerBase this_, object emailCrypt)
        {
            // Try to find userid for email
            var result = Sql.Read("SELECT [id] FROM User WHERE [email]=@email",
                                    new Dictionary<string, object> { { "@email", emailCrypt } });
            // Could'nt Find Exit
            if (result.Count == 0) return null;

            // Block user for timeout if to many access attemps
            // If has increment=true: Check if Blocked.
            // If increment=false: incremement invalid access attemps & Check if it needs to block.
            return IncInvalidForUser(increment, this_, result["id"][0]);
        }
        /// <summary>
        /// Checks for to many access attemps to a user. 
        /// Will block user for a timeout of too many invalid access attemps.
        /// </summary>
        /// <param name="increment">true: increment invalid access attemps, false: just check if it needs to block.</param>
        /// <param name="this_">Controller Base</param>
        /// <param name="token">Access Token</param>
        /// <returns>If ok || access token not found: null else NoAuth.</returns>
        public static IActionResult? IncInvalidForUser_Token(bool increment, ControllerBase this_, object token)
        {
            // Try to find userid for access token
            var result = Sql.Read("SELECT [user_id] FROM Access_Token WHERE [token]=@token",
                                    new Dictionary<string, object> { { "@token", token } });
            // Could'nt Find Exit
            if (result.Count == 0) return null;

            // Block user for timeout if to many access attemps
            // If has increment=true: Check if Blocked.
            // If increment=false: incremement invalid access attemps & Check if it needs to block.
            return IncInvalidForUser(increment, this_, result["user_id"][0]);
        }
        /// <summary>
        /// Checks for to many access attemps to a user. 
        /// Will block user for a timeout of too many invalid access attemps.
        /// </summary>
        /// <param name="increment">true: increment invalid access attemps, false: just check if it needs to block.</param>
        /// <param name="this_">Controller Base</param>
        /// <param name="userid_">(long) user id</param>
        /// <returns>If ok: null else NoAuth.</returns>
        public static IActionResult? IncInvalidForUser(bool increment, ControllerBase this_, object userid_)
        {
            var userid = (long)userid_;

            // Mutex lock on user
            var ulock = GetUserLock(userid);
            lock (ulock)
            {
                // Try to find row for an lately invalid access attemps that have not expired.
                var result = Sql.Read("SELECT [id],[count],[expiry] FROM Blocked_Users " +
                                        "WHERE [user_id]=@userid AND [expiry]>@date",
                                        new Dictionary<string, object>
                                        {
                                            { "@userid", userid },
                                            { "@date", Utilz.ToMtn().ToString("s") }
                                        });

                // If no invalid access attemps lately
                if (result.Count == 0)
                {
                    // If you want to increment invalid access attemps
                    if (increment)
                    {
                        // Insert row of first invalid access attempt.
                        Sql.Write("INSERT INTO Blocked_Users ([user_id],[count],[expiry]) VALUES " +
                                    "(@userid,@count,@expiry)", new Dictionary<string, object>
                                    {
                                    {"@userid", userid },
                                    {"@count", 1 },
                                    {"@expiry", Utilz.ToMtn().Add(Env._blockedAccessTimeOut).ToString("s")}
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
                if (increment || count >= Env._accessAttemps)
                {
                    count++;            // increment invalid access attempts
                    // columns to update
                    var update = new Dictionary<string, object> { { "count", count } };

                    // If gone to next section: increase timeout more.
                    if (count % Env._accessAttemps == 0 && count > Env._accessAttemps)
                    {
                        // Exponential increase: if continueing to access
                        var wait = Env._blockedAccessTimeOut * Math.Max(count / Env._accessAttemps - 2, 1);
                        // Increase timeout
                        expiry = new[] { expiry, Utilz.ToMtn() }.Max() + wait;
                        // Be sure to update it in sql
                        update.Add("expiry", expiry.ToString("s"));
                    }

                    // Update the invalid Access users table
                    var ku = update.Keys.ToList();
                    update.Add("id", id);
                    Sql.Write($"UPDATE Blocked_Users SET {string.Join(", ", ku.Select(k => $"[{k}]=@{k}"))} " +
                                "WHERE [id]=@id", update.ToDictionary(s => "@" + s.Key, s => s.Value), 1);

                    // If user just got a timeout: Delete all access_tokens for that user
                    if (count == Env._accessAttemps)
                        Sql.Write("DELETE FROM Access_Token WHERE [user_id]=@userid",
                                    new Dictionary<string, object> { { "@userid", userid } }, -2);
                }

                // User is blocked: too many invalid access attempts
                if (count >= Env._accessAttemps)
                    return this_.BadRequest(new
                    {
                        Message = $"You are now blocked from access till {expiry} Mountain Standard Time."
                    });

                // User is ok
                return null;
            }
        }

        /// <summary>
        /// Gets the mutex lock for each user id
        /// </summary>
        /// <param name="userid">User id to get the lock</param>
        /// <returns>lock object</returns>
        public static object GetUserLock(long userid)
        {
            if (userid < 0) throw new Exception("Invalid User ID.");
            object ulock;
            // Mutex lock on entire _userLock collection
            lock (_userLock)
            {
                // Expiry for clean up
                var expiry = DateTime.Now.AddHours(1);
                // If does Not have lock for userid
                if (!_userLock.TryGetValue(userid, out var s))
                {
                    ulock = new object();                       // Create Lock object
                    _userLock.Add(userid, (ulock, expiry));     // Add to Map
                }
                // If found
                else
                {
                    ulock = s.lck;                              // Get the lock object
                    _userLock[userid] = (ulock, expiry);        // Update expiry
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
            Sql.Write("DELETE FROM Blocked_Users WHERE [expiry]<@date", new Dictionary<string, object>
            {
                {"@date", Utilz.ToMtn().ToString("s") }
            }, -2);

            // Clean up expired user mutex locks
            lock (_userLock)
            {
                var now = DateTime.Now;
                foreach (var s in _userLock.Where(s => now > s.Value.dt))
                    _userLock.Remove(s.Key);
            }
        }

        public struct Data
        {
            public readonly long id = -1;
            public readonly long sudo_id = -1;
            public readonly bool isAdmin, forwarded;
            public readonly int adminLvl = -1;

            public Data(long id, bool isAdmin = false, bool forwarded = false, int adminLvl = -1, long sudo_id = -1)
            {
                this.id = id;
                this.sudo_id = sudo_id;
                this.isAdmin = isAdmin;
                this.forwarded = forwarded;
                this.adminLvl = adminLvl;
            }
        }
    }
}
