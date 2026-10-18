using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;

namespace StudentExchangeBck.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ListingsController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=../Data.db;";

        // GET: api/listings
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
                        JOIN User u ON l.user_id = u.id
                        ORDER BY l.id DESC;";
                }
                else
                {
                    command.CommandText = @"
                        SELECT l.id, l.title, l.description, l.price, l.category, l.datetime, u.email, u.first_name, u.last_name 
                        FROM Listings l
                        JOIN User u ON l.user_id = u.id
                        WHERE l.category = $category
                        ORDER BY l.id DESC;";
                    command.Parameters.AddWithValue("$category", category);
                }

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        listings.Add(new
                        {
                            Id = reader.GetInt32(0),
                            Title = reader.GetString(1),
                            Description = reader.IsDBNull(2) ? "" : reader.GetString(2),
                            Price = reader.GetDecimal(3),
                            Category = reader.GetString(4),
                            Datetime = reader.IsDBNull(5) ? "" : reader.GetString(5),
                            SellerEmail = reader.GetString(6),
                            SellerName = $"{reader.GetString(7)} {reader.GetString(8)}"
                        });
                    }
                }
            }

            return Ok(listings);
        }

        // POST: api/listings
        [HttpPost]
        public IActionResult CreateListing([FromBody] ListingCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || dto.Price <= 0 || string.IsNullOrWhiteSpace(dto.Category))
            {
                return BadRequest(new { error = "Title, a positive price, and category are required." });
            }

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    INSERT INTO Listings (user_id, title, description, price, category, datetime)
                    VALUES ($userId, $title, $description, $price, $category, datetime('now'));
                    SELECT last_insert_rowid();
                ";

                command.Parameters.AddWithValue("$userId", dto.UserId);
                command.Parameters.AddWithValue("$title", dto.Title);
                command.Parameters.AddWithValue("$description", dto.Description ?? "");
                command.Parameters.AddWithValue("$price", dto.Price);
                command.Parameters.AddWithValue("$category", dto.Category);

                long newId = (long)command.ExecuteScalar()!;

                return Ok(new { message = "Listing created successfully!", id = newId });
            }
        }
    }

    public class ListingCreateDto
    {
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Category { get; set; } = string.Empty;
    }
}