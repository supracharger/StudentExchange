using Microsoft.AspNetCore.Mvc;

namespace StudentExchangeBck
{
    [ApiController]
    [Route("[controller]")]
    public class Condition : ControllerBase
    {
        [HttpGet]
        public IActionResult Get(AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateApp(auth, HttpContext, this, out var ip);
            // Exit if invalid
            if (msg != null) return msg;

            var names = Sql.Read("SELECT name FROM Condition")["name"];

            return Ok(names);
        }
    }
}
