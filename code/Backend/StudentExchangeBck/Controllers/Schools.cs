using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck{
    [ApiController]
    [Route("[controller]")]
    public class Schools : ControllerBase{
        [HttpGet]
        public IActionResult Get(){//list the schools
            try
            {
                // Get Schools from db
                var result = Sql.Read("SELECT [name],[short_name] FROM Schools ORDER BY [name]");

                return new OkObjectResult(new
                {
                    Schools = result["name"],
                    short_names = result["short_name"]
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

        [HttpPost]
        public IActionResult Post(Info info){//add a school ADMIN 10+
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Can't Forward user
            if (user.forwarded)
                return BadRequest(new
                {
                    Message = "user cannot be forwarded."
                });

            // Not Authorized: Not Admin or Admin level too low
            if (!user.isAdmin || user.adminLvl < 10)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                return Unauthorized(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // Make sure not blank
                if (string.IsNullOrWhiteSpace(info.name))
                    throw new ArgumentException("name cannot be blank.");
                if (string.IsNullOrWhiteSpace(info.short_name))
                    throw new ArgumentException("short_name cannot be blank");

                // First upper ignore stop words
                info.name = Utilz.FirstUpper(info.name, ignoreStopWords: true).Trim();
                // Remove intermediate extra white spaces
                info.short_name = string.Join(' ', info.short_name.Split(' ', StringSplitOptions.RemoveEmptyEntries)).Trim();

                // Add School
                var cnt = Sql.Write("INSERT INTO Schools ([name], [short_name]) VALUES (@name, @short);", new Dictionary<string, object>
                {
                    { "@name", info.name },
                    { "@short", info.short_name }
                }, 1);
                if (cnt == 0)
                    throw new ArgumentException("Nothing was inserted.");

                // Success
                return StatusCode(201, new
                {
                    Message = "School added successfully!",
                    Name = info.name,
                    short_name = info.short_name
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
        public IActionResult Delete(Info info){//remove a school ADMIN 10+
            // Validate Application Access & Access Token
            var msg = AppAuthJson.ValidateWithToken(this, info, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            // Can't Forward user
            if (user.forwarded)
                return BadRequest(new
                {
                    Message = "user cannot be forwarded."
                });

            // Not Authorized: Not Admin or Admin level too low
            if (!user.isAdmin || user.adminLvl < 10)
            {
                // IP Blocking & Tracking
                var msg2 = IP.IncInvalidForIP(true, this, ip.id);
                if (msg2 != null) return msg2;

                return Unauthorized(new
                {
                    Message = "Not authorized."
                });
            }

            try
            {
                // Add fields to search
                var d = new Dictionary<string, object>();
                if (!string.IsNullOrWhiteSpace(info.name))
                    d.Add("name", Utilz.FirstUpper(info.name, ignoreStopWords: true));
                if (!string.IsNullOrWhiteSpace(info.short_name))
                    d.Add("short_name", info.short_name);

                // Nothing to update
                if (d.Count == 0)
                    throw new ArgumentException("All of the fields are blank.");

                // Delete School
                var cnt = Sql.Write("DELETE FROM Schools " +
                                    $"WHERE {string.Join(" AND ", d.Keys.Select(k => $"[{k}]=@{k}"))};", 
                                    d, 1);
                if (cnt == 0)
                    throw new ArgumentException("Nothing was Deleted.");
                
                // Success
                return Ok(new
                {
                    Message = "School deleted successfully!",
                    Name = info.name,
                    short_name = info.short_name,
                    row_count = cnt
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

        public class Info : AppAuthJson{
            public string? name { get; set; }
            public string? short_name { get; set; }
        }
    }
}