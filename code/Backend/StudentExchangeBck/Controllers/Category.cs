using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck
{
    [ApiController]
    [Route("[controller]")]
    public class Category : ControllerBase
    {
        [HttpGet]
        public IActionResult Get(AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateApp(auth, HttpContext, this, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            var names = Sql.Read("SELECT name FROM Listings_Category WHERE visable=1")["name"];

            return Ok(names);
        }

        [HttpPost]
        public IActionResult Post(Data data)
        {
            var msg = AppAuthJson.ValidateWithToken(this, data, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            if (user.adminLvl < 10)
                return Unauthorized("Not Authorized.");

            if (string.IsNullOrWhiteSpace(data.category))
                return BadRequest(new { Message = "category is empty." });

            data.category = Utilz.FirstUpper(data.category, ignoreStopWords: true);

            try
            {
                var name = new Dictionary<string, object>
                {
                    { "@name", data.category }
                };
                var cnt = 0;
                try
                {
                    cnt = Sql.Write("UPDATE Listings_Category SET visable=1 WHERE name=@name", name, 1);
                }
                catch { }

                if (cnt == 0)
                    Sql.Write("INSERT INTO Listings_Category (name) VALUES (@name);", name, 1);

                return StatusCode(201, new
                {
                    Message = "Category created.",
                    Category = data.category
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
        public IActionResult Delete(Data data)
        {
            var msg = AppAuthJson.ValidateWithToken(this, data, HttpContext, out var user, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            if (user.adminLvl < 10)
                return Unauthorized("Not Authorized.");

            if (string.IsNullOrWhiteSpace(data.category))
                return BadRequest(new { Message = "category is empty." });

            data.category = Utilz.FirstUpper(data.category, ignoreStopWords: true);

            try
            {
                var name = new Dictionary<string, object>
                {
                    { "@name", data.category }
                };
                try
                {
                    Sql.Write("UPDATE Listings_Category SET visable=0 WHERE name=@name", name, 1);
                }
                catch
                {
                    return BadRequest("Category not found.");
                }

                Sql.Write("DELETE From Listings_Category WHERE name=@name",name, 1);


                return Ok(new
                {
                    Message = "Category deleted.",
                    Category = data.category
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

        public class Data : AppAuthJson
        {
            public string? category { get; set; }
        }
    }
}
