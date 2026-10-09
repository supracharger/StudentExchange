using Microsoft.AspNetCore.Mvc;

/* Schools EndPoint
 
   GET Get():
        Get List of used Schools.
        Input: {}
        RETURNS: { Schools: [...], short_names: [...] }
 */

namespace StudentExchangeBck
{
    [ApiController]
    [Route("[controller]")]
    public class Schools : ControllerBase
    {
        /// <summary>
        /// Get List of used Schools.
        /// Input: {}
        /// </summary>
        /// <returns>{ Schools: [...], short_names: [...] }</returns>
        [HttpGet]
        public IActionResult Get()
        {
            // Get Schools from db
            var result = Sql.Read("SELECT [name],[short_name] FROM Schools ORDER BY [name]");
            return new OkObjectResult(new
            {
                Schools = result["name"],
                short_names = result["short_name"]
            });
        }
    }
}
