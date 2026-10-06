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
        public string? admin_token { get; set; }

        /// <summary>
        /// Validate Application access password
        /// </summary>
        /// <param name="access">Object containing app_access</param>
        /// <returns>Not Authorized or null</returns>
        public static IActionResult? ValidateApp(AppAuthJson access, HttpContext ctx, ControllerBase this_, out IP.Data ip)
        {
            // Condition if access is invalid
            var invalidAccess = access.app_access == null || access.app_access != Env._appAccess;
            var invalidAdmin = access.admin_token != null && access.admin_token != Env._adminToken;

            // Add IP to DB if not there
            var msg = IP.UpdateByIP(ctx, this_, out var ipid);
            ip = new IP.Data(ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;
            // Validates IP Address Blocking
            msg = IP.IncInvalidForIP(invalidAccess || invalidAdmin, this_, ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;

            // Forward the actual IP Address
            // ipid: Now equals forwarded ip address.
            if (!string.IsNullOrWhiteSpace(access.ip) && !invalidAdmin && access.admin_token != null)
            {
                msg = IP.UpdateByIP(access.ip, this_, out ipid);
                ip = new IP.Data(ipid, forwarded: true);
                if (msg != null) return msg;
            }

            // No Auth: Message to Client
            if (invalidAccess)
            {
                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            }
            // Success
            else return null;
        }

        /// <summary>
        /// Validates Application Password & Access Token
        /// </summary>
        /// <param name="this_">Controller base</param>
        /// <param name="access">Object containing info</param>
        /// <param name="userId">RETURNED userid corisponding to access token</param>
        /// <returns>No Authorized or null</returns>
        public static IActionResult? ValidateToken(ControllerBase this_, AppAuthJson access, long ipid, out User.Data user)
        {
            user = new User.Data();
            try
            {
                // If Access token is empty
                if (string.IsNullOrWhiteSpace(access.access_token))
                    return new UnauthorizedObjectResult(new
                    {
                        Message = "Not authorized."
                    });

                // Find coresponding userid for Access token
                var result = Sql.Read("SELECT [user_id] FROM Access_Token WHERE [token]=@token AND [expiry]>@date",
                                new Dictionary<string, object>
                                {
                                {"@token", access.access_token },
                                {"@date", Utilz.ToMtn().ToString("s") }
                                });
                // If not found
                if (result.Count == 0)
                    throw new ArgumentException("The Access Token may have expired.");

                // Get User ID
                user = new User.Data((long)result["user_id"][0]);

                // Add relation of user to IP: if not there
                if (ipid >= 0)
                    IP.TrackIPToUser(ipid, user.id);

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
        /// Validates Access Token
        /// </summary>
        /// <param name="this_">Controller base</param>
        /// <param name="access">Object containing info</param>
        /// <param name="ctx">Http Context</param>
        /// <param name="userId">RETURNED userid corisponding to access token</param>
        /// <returns>No Authorized or null</returns>
        /// <summary>
        public static IActionResult? ValidateWithToken(ControllerBase this_, AppAuthJson access, HttpContext ctx, out User.Data user, out IP.Data ip)
        {
            // Validate Application Password
            var msg = ValidateApp(access, ctx, this_, out ip);
            if (msg != null)
            { 
                user = new User.Data();
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
