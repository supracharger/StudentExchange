using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck.Controllers{
    [ApiController]
    [Route("[controller]")]
    public class Admin : ControllerBase{//manages who is an admin and at what level, 4 methods map to 4 standard HTTP verbs
        [HttpGet]
        public IActionResult Get(AppAuthJson auth){//admin at what level
            //validate application access & access token
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            // exit if invalid
            if (msg != null) return msg;

            // not authorized: user can't be forwarded
            if (user.forwarded)
                return BadRequest(new
                {
                    Message = "User cannot be forwarded."
                });

            // Is Not Admin
            if (!user.isAdmin)
                return Ok(new
                {
                    is_admin = false
                });

            // Is Admin
            return Ok(new
            {
                is_admin = true,
                level = user.adminLvl
            });
        }

        [HttpPost]
        public IActionResult Post(Info info){//make someone an admin
            //validate application access & access token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            // exit if invalid
            if (msg != null) return msg;

            // admin level too low
            if (user.adminLvl <= 0 || (info.locked != null && user.adminLvl < 30))
                return Unauthorized(new
                {
                    Message = "Not authorized."
                });

            // Not Authorized: User needs to be forwarded
            if (!user.forwarded)
                return BadRequest(new
                {
                    Message = "User needs be forwarded."
                });

            // Forwarded user is already an admin
            if (user.isAdmin)
                return BadRequest(new
                {
                    Message = "Forwarded user is already an admin."
                });

            try
            {
                // Validate level
                ValidateLevel(user, info);

                // Info to insert
                var d = new Dictionary<string, object>
                {
                    { "user_id", user.id },
                    { "level", info.level!.Value }
                };

                // Add locked if auth
                if (info.locked != null)
                    d.Add("locked", info.locked.Value);

                var k = d.Keys.ToList();
                d = d.ToDictionary(s => "@" + s.Key, s => s.Value);
                // Insert into table
                Sql.Write($"INSERT INTO Admins ({string.Join(',', k.Select(s => $"[{s}]"))}) VALUES " +
                            $"({string.Join(',', k.Select(s => "@" + s))});", d, 1);

                // Success
                return StatusCode(201, new
                {
                    Message = "Successfully added user as admin.",
                    Email = info.to_user
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

        [HttpPatch]
        public IActionResult Patch(Info info){//change admin level or locked status
            //validate application access & access token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            //exit if invalid
            if (msg != null) return msg;

            //admin lvl to low
            if (user.adminLvl <= 0 || (info.locked != null && user.adminLvl < 30))
                return Unauthorized(new
                {
                    Message = "Not authorized."
                });

            // Not Authorized: User needs to be forwarded
            if (!user.forwarded)
                return BadRequest(new
                {
                    Message = "User needs be forwarded."
                });

            // Forwarded user is not admin
            if (!user.isAdmin)
                return BadRequest(new
                {
                    Message = "Forwarded user is not an admin."
                });

            try
            {
                // Validate level
                ValidateLevel(user, info);

                // Info to insert
                var d = new Dictionary<string, object>
                {
                    { "user_id", user.id },
                    { "level", info.level!.Value }
                };

                // Add locked if auth
                if (info.locked != null)
                    d.Add("locked", info.locked.Value);

                var k = d.Keys.ToList();
                k.Remove("user_id");
                d = d.ToDictionary(s => "@" + s.Key, s => s.Value);

                // Update table
                Sql.Write($"UPDATE Admins SET {string.Join(", ", k.Select(s => $"[{s}]=@{s}"))} " +
                            "WHERE [user_id]=@user_id;", d, 1);

                // Success
                return Ok(new
                {
                    Message = "Successfully updated admin authentication.",
                    Email = info.to_user
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

        [HttpDelete]
        public IActionResult Delete(AppAuthJson auth){//removes someone's admin status
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Admin Level to low
            if (user.adminLvl <= 0)
                return Unauthorized(new
                {
                    Message = "Not authorized."
                });

            // Not Authorized: User needs to be forwarded
            if (!user.forwarded)
                return BadRequest(new
                {
                    Message = "User needs be forwarded."
                });

            // Forwarded user is not admin
            if (!user.isAdmin)
                return BadRequest(new
                {
                    Message = "Forwarded user is not an admin."
                });

            try
            {
                // Insert into table
                Sql.Write("DELETE FROM Admins WHERE [user_id]=@userid;", new Dictionary<string, object>
                {
                    { "@userid", user.id }
                }, 1);

                // Success
                return Ok(new
                {
                    Message = "Successfully removed admin status from user.",
                    Email = auth.to_user
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

        static void ValidateLevel(in Users.Data user, Info info){//check level
            if (info.level == null || info.level.Value < 0)
                throw new ArgumentException("Invalid 'level' value.");

            if (info.level.Value >= user.adminLvl)
                throw new ArgumentException("'level' must be smaller than the admin level of the assigning user.");

            if (info.locked != null && !new[] { 0, 1 }.Contains(info.locked.Value))
                throw new ArgumentException("locked is contrained to values 0 or 1.");
        }

        public class Info : AppAuthJson
        {
            public int? level { get; set; }
            public int? locked { get; set; }
        }
    }
}