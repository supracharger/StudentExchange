using Microsoft.AspNetCore.Mvc;
using static StudentExchangeBck.Register;

/* LogIn EndPoint:
    
   POST Post():
        Login POST: Uses password and email to login.
        Input: {'email', 'password', 'app_access'}
        Returns: If successfull: {'access_token', 'first_name'}

   DELETE Delete():
        Log Out
        On Success: Deletes all access tokens for given user.
        Input: {'app_access', 'access_token'}
        Returns: OK(), Status 200

   ========================================================================

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
    [ApiController]
    [Route("[controller]")]
    public class LogIn : ControllerBase
    {
        /// <summary>
        /// Login POST: Uses password and email to login.
        /// If successfull: Returns {'access_token', 'first_name'}
        /// </summary>
        /// <param name="data">Input: {'email', 'password', 'app_access'}</param>
        /// <returns>If successfull: Returns {'access_token', 'first_name'}</returns>
        [HttpPost]
        public IActionResult Post(Info data)
        {
            // Validate Application Access
            var msg = AppAuthJson.ValidateApp(data, HttpContext, this, out var ip);
            // If no Auth: return no auth
            if (msg != null) return msg;

            string emailCrypt, passCrypt;
            try
            {
                // Email & Password: can't be blank or white space
                if (string.IsNullOrWhiteSpace(data.email))
                    throw new ArgumentException("There needs to be a email.");
                if (string.IsNullOrWhiteSpace(data.password))
                    throw new ArgumentException("There needs to be a password.");

                // Encrypt for sql
                emailCrypt = DeterministicEncryption.Encrypt(data.email.Trim().ToLower(), Env._emailSalt);
                passCrypt = DeterministicEncryption.Encrypt(data.password.Trim(), Env._passSalt);

                // Find results for Email & Password given
                var result = Sql.Read("SELECT U.[id],U.[first_name], (A.[user_id] IS NOT NULL) isAdmin " +
                                    "FROM User U " +
                                    "LEFT JOIN Admins A ON U.[id]=A.[user_id] " +
                                    "WHERE U.[email]=@email AND U.[password]=@pass",
                                new Dictionary<string, object>
                                {
                                    {"@email", emailCrypt },
                                    {"@pass", passCrypt }
                                });

                var noresults = result.Count == 0;

                // Block user for timeout if too many access attemps
                // If has result: Check if Blocked.
                // If not has result: incremement invalid access attemps & Check if it needs to block.
                msg = Users.IncInvalidForUser_Email(noresults, this, emailCrypt);

                // Block IP for timeout if too many access attemps
                // incremement invalid access attemps & Check if it needs to block.
                if (noresults && ip.forwarded)
                {
                    // Potentially Block IP
                    var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                    // If it needs to block user
                    if (msg2 != null) return msg2;
                }

                // If it needs to block user
                if (msg != null) return msg;

                // Invalid Email or Password
                if (noresults)
                    throw new ArgumentException("Invalid Email or Password.");

                // Get id & first_name
                var id = (long)result["id"][0];
                var first_name = result["first_name"][0];
                var isadmin = (long)result["isAdmin"][0] != 0;
                object token;

                // Add relation of user to IP: if not there
                if (ip.id >= 0)
                    IP.TrackIPToUser(ip.id, id);

                // Mutex lock on user
                var ulock = Users.GetUserLock(id);
                lock (ulock)
                {
                    // Try to find not expired access token
                    result = Sql.Read("SELECT [token] FROM Access_Token WHERE [user_id]=@id AND [expiry]>@now",
                                new Dictionary<string, object>
                                {
                                {"@id", id },
                                {"@now", Utilz.ToMtn().AddDays(1).ToString("s") },
                                });

                    // Found access token
                    if (result.Count != 0)
                        token = result["token"][0];
                    // Did not find access token
                    else
                    {
                        token = null!;
                        // There is a very small chance that it generates the same token. However,
                        // if it does, this will fix it.
                        for (int i = 0; i < 5; i++)
                        {
                            try
                            {
                                // Generate Access Token
                                token = AccessToken.Generate();
                                // Insert Access token into db
                                Sql.Write("INSERT INTO Access_Token ([user_id],[token],[expiry]) VALUES " +
                                    "(@user,@token,@expiry)", new Dictionary<string, object>
                                    {
                                    { "@user", id },
                                    { "@token", token },
                                    { "@expiry", Utilz.ToMtn(DateTime.UtcNow.Add(isadmin ? Env._tokenExpiryAdmin : Env._tokenExpiry)).ToString("s") }
                                    }, 1);
                                break;  // Success Break
                            }
                            // Unsucessfull: token was not unique
                            catch { token = null!; }
                        }

                        if (token == null)
                            throw new Exception("After serveral attempts, the Access Token could not be generated.");
                    }
                }

                // Success
                return StatusCode(201, new
                {
                    Message = "Successfull Login.",
                    access_token = token,
                    first_name = first_name
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
        /// Log Out
        /// On Success: Deletes all access tokens for given user.
        /// </summary>
        /// <param name="data">Input: {'app_access', 'access_token'}</param>
        /// <returns>OK(), Status 200</returns>
        [HttpDelete]
        public IActionResult Delete(AppAuthJson data)
        {
            // Validate Application Access
            var msg = AppAuthJson.ValidateApp(data, HttpContext, this, out var ip);
            // Exit: No Auth
            if (msg != null) return msg;

            // Validate Application Access & Access Token
            msg = AppAuthJson.ValidateToken(this, data, ip.id, out var user);
            // Exit if invalid: No need to show an error.
            if (msg != null) return Ok(new
            {
                Message = "You have been logged out."
            });

            try
            {
                // Delete All Access Tokens for user id
                Sql.Write("DELETE FROM Access_Token WHERE [user_id]=@userid",
                            new Dictionary<string, object> { { @"userid", user.id } }, -2);

                // Success
                return Ok(new
                {
                    Message = "You have been logged out."
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
        /// Occasionally should be used to clean up resources
        /// </summary>
        public static void CleanUp()
        {
            // Clean up old access tokens
            Sql.Write("DELETE FROM Access_Token WHERE [expiry]<@date", new Dictionary<string, object>
            {
                {"@date", Utilz.ToMtn().ToString("s") }
            }, -2);
        }

        public class Info : AppAuthJson
        {
            public string? email { get; set; }
            public string? password { get; set; }
        }
    }
}
