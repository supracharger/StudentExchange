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
        public static IActionResult? Validate(AppAuthJson access, HttpContext ctx)
        {
            //var clientIp = ctx.Connection.RemoteIpAddress?.ToString();
            if (access.app_access == null || access.app_access != Env._appAccess)
            {
                return new UnauthorizedObjectResult(new
                {
                    Message = "Not authorized."
                });
            }
            else return null;
        }

        /// <summary>
        /// Validates Application Password & Access Token
        /// </summary>
        /// <param name="this_">Controller base</param>
        /// <param name="access">Object containing info</param>
        /// <param name="userId">RETURNED userid corisponding to access token</param>
        /// <returns>No Authorized or null</returns>
        public static IActionResult? ValidateWithToken(ControllerBase this_, AppAuthJson access, HttpContext ctx, out object userId, out bool isadmin)
        {
            userId = null!;
            isadmin = false;
            try
            {
                // Validate Application Password
                var msg = Validate(access, ctx);
                if (msg != null) return msg;

                // If Access token is empty
                if (string.IsNullOrWhiteSpace(access.access_token))
                    return new UnauthorizedObjectResult(new
                    {
                        Message = "Not authorized."
                    });

                // Find coresponding userid for Access token
                var result = Sql.Read("SELECT T.[user_id] user_id, (A.[user_id] IS NOT NULL) isAdmin " +
                                    "FROM Access_Token T " +
                                    "LEFT JOIN Admins A ON T.[user_id]=A.[user_id] " +
                                    "WHERE T.[token]=@token AND T.[expiry]>@date",
                                new Dictionary<string, object>
                                {
                                {"@token", access.access_token },
                                {"@date", Utilz.ToMtn().ToString("s") }
                                });
                // If not found
                if (result.Count == 0)
                    throw new ArgumentException("The Access Token may have expired.");

                userId = result["user_id"][0];
                isadmin = (long)result["isAdmin"][0] != 0;
                return null;                    // Success
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
    }
}
