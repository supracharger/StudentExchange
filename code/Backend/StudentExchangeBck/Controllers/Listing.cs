using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;

namespace StudentExchangeBck.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ListingController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=../Data.db;";

        // GET: api/listing
        [HttpGet]
        public IActionResult GetListings([FromQuery] string? category = null)
        {
            var listings = new List<object>();

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();

                if (string.IsNullOrEmpty(category))
                {
                    command.CommandText = @"
                        SELECT l.id, l.title, l.description, l.price, l.category, l.datetime, u.email, u.first_name, u.last_name 
                        FROM Listings l
                        JOIN User u ON l.user_id = u.id";
                }
                else
                {
                    command.CommandText = @"
                        SELECT l.id, l.title, l.description, l.price, l.category, l.datetime, u.email, u.first_name, u.last_name 
                        FROM Listings l
                        JOIN User u ON l.user_id = u.id
                        WHERE l.category = $category";
                    command.Parameters.AddWithValue("$category", category);
                }

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        listings.Add(new
                        {
                            id = reader.GetInt32(0),
                            title = reader.GetString(1),
                            description = reader.GetString(2),
                            price = reader.GetDecimal(3),
                            category = reader.GetString(4),
                            datetime = reader.GetString(5),
                            email = reader.GetString(6),
                            first_name = reader.GetString(7),
                            last_name = reader.GetString(8)
                        });
                    }
                }
            }

            return Ok(listings);
        }

        // POST: api/listing
        [HttpPost]
        public IActionResult CreateListing([FromBody] ListingCreateModel model)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    INSERT INTO Listings (title, description, price, category, user_id, datetime)
                    VALUES ($title, $description, $price, $category, $user_id, $datetime);";
                
                command.Parameters.AddWithValue("$title", model.Title);
                command.Parameters.AddWithValue("$description", model.Description);
                command.Parameters.AddWithValue("$price", model.Price);
                command.Parameters.AddWithValue("$category", model.Category);
                command.Parameters.AddWithValue("$user_id", model.UserId);
                command.Parameters.AddWithValue("$datetime", DateTime.UtcNow.ToString("o"));

                command.ExecuteNonQuery();
            }

            return Ok(new { message = "Listing created successfully!" });
        }

        // DELETE: api/listing/{id}
        [HttpDelete("{id}")]
        public IActionResult DeleteListing(int id)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "DELETE FROM Listings WHERE id = $id;";
                command.Parameters.AddWithValue("$id", id);

                int rowsAffected = command.ExecuteNonQuery();
                if (rowsAffected == 0)
                {
                    return NotFound(new { message = "Listing not found." });
                }
            }

            return Ok(new { message = "Listing deleted successfully!" });
        }
    }

    public class ListingCreateModel
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Category { get; set; } = string.Empty;
        public int UserId { get; set; }
    }
}