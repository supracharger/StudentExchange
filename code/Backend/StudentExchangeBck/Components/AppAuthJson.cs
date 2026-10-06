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

        /// <summary>
        /// Validate Application access password
        /// </summary>
        /// <param name="access">Object containing app_access</param>
        /// <returns>Not Authorized or null</returns>
        public static IActionResult? ValidateApp(AppAuthJson access, HttpContext ctx, ControllerBase this_, out long ipid)
        {
            // Condition if access is invalid
            var invalidAccess = access.app_access == null || access.app_access != Env._appAccess;

            // Add IP to DB if not there
            var msg = IP.UpdateByIP(ctx, this_, out ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;
            // Validates IP Address Blocking
            msg = IP.IncInvalidForIP(invalidAccess, this_, ipid);
            // Exit: There is a message to client
            if (msg != null) return msg;

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
        public static IActionResult? ValidateToken(ControllerBase this_, AppAuthJson access, long ipid, out object userId)
        {
            userId = null!;
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
                userId = result["user_id"][0];

                // Add relation of user to IP: if not there
                if (ipid >= 0)
                    IP.TrackIPToUser(ipid, (long)userId);

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
        public static IActionResult? ValidateWithToken(ControllerBase this_, AppAuthJson access, HttpContext ctx, out object userId, out long ipid)
        {
            userId = null!;
            
            // Validate Application Password
            var msg = ValidateApp(access, ctx, this_, out ipid);
            if (msg != null) return msg;

            // Validate Access Token
            msg = ValidateToken(this_, access, ipid, out userId);
            if (msg != null) return msg;

            // Success
            return null;
        }
    }
}
