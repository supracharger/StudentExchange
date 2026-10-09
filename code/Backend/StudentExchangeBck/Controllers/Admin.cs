using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

/* Admin:
 
   GET Get():
      Returns if admin or not
      if admin: will also have admin level
      Input: {app_access, access_token}
      Output: on success: {is_admin, level}  
 */

namespace StudentExchangeBck.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class Admin : ControllerBase
    {
        /// <summary>
        /// Returns if admin or not
        /// if admin: will also have admin level
        /// </summary>
        /// <param name="auth">Input: {app_access, access_token}</param>
        /// <returns>Output: on success: {is_admin, level}</returns>
        [HttpGet]
        public IActionResult Get(AppAuthJson auth)
        {
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Not Authorized: User can't be forwarded
            if (user.forwarded)
                return new BadRequestObjectResult(new
                {
                    Message = "User cannot be forwarded."
                });

            // Is Not Admin
            if (!user.isAdmin)
                return new OkObjectResult(new
                {
                    is_admin = false
                });

            // Is Admin
            return new OkObjectResult(new
            {
                is_admin = true,
                level = user.adminLvl
            });
        }
    }
}
