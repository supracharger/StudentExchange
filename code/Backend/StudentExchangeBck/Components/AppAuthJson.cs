using Microsoft.AspNetCore.Mvc;

/* Data Containing Application Password & Access Token:
 *      - Also, methods validate the two.
 */

namespace StudentExchangeBck
{
    public class AppAuthJson
    {
        // Application Access Password
        public string? app_access { get; set; }
        // Access Token for user info
        public string? access_token { get; set; }

        // IP Forwarding
        public string? ip { get; set; }
        // Admin Token
        // Only used for ip forwarding
        // IP frowarding is only used for the website. Do NOT use it with the mobile app!
        public string? admin_token { get; set; }
        // User Forwarding
        public string? to_user { get; set; }

        /// <summary>
        /// Validate Application access password
        /// </summary>
        /// <param name="access">Object containing app_access</param>
        /// <returns>Not Authorized or null</returns>
        public static IActionResult? ValidateApp(AppAuthJson access, HttpContext ctx, ControllerBase this_, out IP.Data ip)
        {
            // Condition if access is invalid
            var invalidAccess = access.app_access == null || access.app_access != Env._appAccess;

            var invalidAdmin = false;
            var sudoIsAdmin = false;
            // Validate Admin Token is for an Admin
            if (access.admin_token != null)
            {
                // Not null or whitespace
                invalidAdmin = string.IsNullOrWhiteSpace(access.admin_token);
                // If still ok
                if (!invalidAdmin)
                {
                    // Not null or whitespace
                    if (!string.IsNullOrWhiteSpace(access.ip))
                    {
                        try
                        {
                            // Find coresponding userid for Access token
                            var result = Sql.Read("SELECT T.[user_id], (A.[user_id] IS NOT NULL) isAdmin " +
                                                "FROM Access_Token T " +
                                                "LEFT JOIN Admins A ON T.[user_id]=A.[user_id] " +
                                                "WHERE [token]=@token AND [expiry]>@date",
                                            new Dictionary<string, object>
                                            {
                                            {"@token", access.admin_token },
                                            {"@date", Utilz.ToMtn().ToString("s") }
                                            });

                            // Access token may have expired
                            if (result.Count == 0)
                            {
                                ip = new IP.Data();
                                return this_.BadRequest(new
                                {
                                    Message = "The Access Token may have expired.",
                                    Expired = true
                                });
                            }

                            // If Admin
                            sudoIsAdmin = (long)result["isAdmin"][0] != 0;
                            // If not admin: this is invalid admin
                            if (!sudoIsAdmin)
                                invalidAdmin = true;
                        }
                        catch (ArgumentException e)
                        {
                            ip = new IP.Data();
                            return this_.BadRequest(new
                            {
                                Message = e.Message
                            });
                        }
                        catch (Exception e)
                        {
                            ip = new IP.Data();
                            return this_.StatusCode(500, new
                            {
                                Message = $"An internal server error occurred: {e}"
                            });
                        }
                    }
                }
            }

            // Add IP to DB if not there
            var msg = IP.UpdateByIP(ctx, this_, out var ipid);
            ip = new IP.Data(ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;
            // Validates IP Address Blocking
            msg = IP.IncInvalidForIP(invalidAccess || invalidAdmin, this_, ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;

            // No Auth: Message to Client
            if (invalidAccess)
                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            
            // Forward the actual IP Address
            // ipid: Now equals forwarded ip address.
            if (!string.IsNullOrWhiteSpace(access.ip) && !invalidAdmin && sudoIsAdmin && access.admin_token != null)
            {
                msg = IP.UpdateByIP(access.ip, this_, out ipid);
                ip = new IP.Data(ipid, forwarded: true, sudo_id: ip.id);
                if (msg != null) return msg;
            }

            // Success
            return null;
        }

        /// <summary>
        /// Validates Application Password & Access Token
        /// </summary>
        /// <param name="this_">Controller base</param>
        /// <param name="access">Object containing info</param>
        /// <param name="userId">RETURNED userid corisponding to access token</param>
        /// <returns>No Authorized or null</returns>
        public static IActionResult? ValidateToken(ControllerBase this_, AppAuthJson access, long ipid, out Users.Data user)
        {
            user = new Users.Data();
            try
            {
                // If Access token is empty
                if (string.IsNullOrWhiteSpace(access.access_token))
                    return this_.Unauthorized(new
                    {
                        Message = "Not authorized."
                    });

                // Find coresponding userid for Access token
                var result = Sql.Read("SELECT T.[user_id], A.[level], (A.[user_id] IS NOT NULL) isAdmin " +
                                    "FROM Access_Token T " +
                                    "LEFT JOIN Admins A ON T.[user_id]=A.[user_id] " +
                                    "WHERE [token]=@token AND [expiry]>@date",
                                new Dictionary<string, object>
                                {
                                {"@token", access.access_token },
                                {"@date", Utilz.ToMtn().ToString("s") }
                                });
                // If not found
                if (result.Count == 0)
                    throw new ArgumentException("The Access Token may have expired.");

                int adminLvl = -1;
                var isadmin = ((long)result["isAdmin"][0]) != 0;
                if (isadmin)
                    adminLvl = (int)(long)result["level"][0];
                // Get User ID
                user = new Users.Data((long)result["user_id"][0], 
                                    isAdmin: isadmin, adminLvl: adminLvl);

                // Admin Privlage forward to different user
                if (access.to_user != null)
                {
                    // if main user is not admin
                    if (!user.isAdmin)
                    {
                        // Increment Block IP
                        var msg = IP.IncInvalidForIP(true, this_, ipid);
                        // Block IP
                        if (msg != null)
                        {
                            user = new Users.Data();
                            return msg;
                        }

                        // Not Authorized, Not Admin
                        return this_.Unauthorized(new
                        {
                            Message = "Not authorized."
                        });
                    }

                    // Check for blank
                    if (string.IsNullOrWhiteSpace(access.to_user))
                        throw new ArgumentException("to_user cannot be blank");

                    // Get user id from db
                    result = Sql.Read("SELECT U.[id], A.[level], " +
                                    "(A.[user_id] IS NOT NULL) isAdmin, " +
                                    "A.locked " +
                                    "FROM User U " +
                                    "LEFT JOIN Admins A ON U.[id]=A.[user_id] " +
                                    "WHERE U.[email]=@email;",
                            new Dictionary<string, object>
                            {
                                { "@email", DeterministicEncryption.Encrypt(access.to_user, Env._emailSalt) }
                            });
                    // Could not find user
                    if (result.Count == 0)
                        throw new ArgumentException("to_user is not found in the Data Base.");

                    var isAdmin = (long)result["isAdmin"][0] != 0;
                    if (isAdmin)
                    {
                        var level = (int)(long)result["level"][0];
                        if (level >= user.adminLvl)
                        {
                            user = new Users.Data();
                            return new UnauthorizedObjectResult(new
                            {
                                Message = "Cannot forward user Admin with equal or greater admin level."
                            });
                        }
                    }

                    var id = (long)result["id"][0];

                    // Cannot forward yourself
                    if (id == user.id)
                        throw new ArgumentException("You are forwarding yourself as a user.");

                    if ((long)result["locked"][0] != 0 && user.adminLvl < 3)
                    {
                        user = new Users.Data();
                        return this_.Unauthorized(new
                        {
                            Message = "The user you are forwarding is a locked admin."
                        });
                    }

                    // Success
                    user = new Users.Data(id, forwarded: true, sudo_id: user.id, adminLvl:user.adminLvl);
                }

                // Add relation of user to IP: if not there
                if (ipid >= 0)
                    IP.TrackIPToUser(ipid, user.id);

                // Success
                return null;                    
            }
            catch (ArgumentException e)
            {
                user = new Users.Data();
                return this_.BadRequest(new
                {
                    Message = e.Message
                });
            }
            catch (Exception e)
            {
                user = new Users.Data();
                return this_.StatusCode(500, new
                {
                    Message = $"An internal server error occurred: {e}"
                });
            }
        }



        /// <summary>
        /// Validates Access Token
        /// </summary>
        /// <param name="this_">Controller base</param>
        /// <param name="access">Object containing info</param>
        /// <param name="ctx">Http Context</param>
        /// <param name="userId">RETURNED userid corisponding to access token</param>
        /// <returns>No Authorized or null</returns>
        /// <summary>
        public static IActionResult? ValidateWithToken(ControllerBase this_, AppAuthJson access, HttpContext ctx, out Users.Data user, out IP.Data ip)
        {
            // Validate Application Password
            var msg = ValidateApp(access, ctx, this_, out ip);
            if (msg != null)
            { 
                user = new Users.Data();
                return msg; 
            }

            // Validate Access Token
            msg = ValidateToken(this_, access, ip.id, out user);
            if (msg != null) return msg;

            // Success
            return null;
        }
    }
}
