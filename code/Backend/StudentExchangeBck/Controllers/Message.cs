using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
 
/* Message EndPoint: messages and offers between a buyer and the seller of a listing.
   One conversation per (listing, buyer). The seller is the owner of the listing.
 
   GET Message:                     api/message
        My conversations, newest activity first (with unread counts).
        Input: {app_access, access_token}
 
   GET Message/unread:              api/message/unread
        Number of unread messages (for a badge).
        Input: {app_access, access_token}
 
   GET Message/{conversationId}:    api/message/{conversationId}?after=<message id>
        Messages of one conversation, oldest first. Marks the other person's messages as read.
        Only the buyer and the seller can read it.
        Input: {app_access, access_token}
 
   POST Message:                    api/message
        Send a message or an offer.
        Input: {app_access, access_token, listing_id || conversation_id,
                kind?: 'message' | 'offer', text?, amount? (offers only)}
        - Buyer starts a conversation with listing_id.
        - Either person continues it with conversation_id.
 
   ===========================================================================
 
   CleanUp():
        Occasionally should be used to clean up resources
 */
 
namespace StudentExchangeBck.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MessageController : ControllerBase
    {
        const int MaxTextLength = 1000;        // characters in one message
        const int MaxPerMinute = 20;           // messages one user may send per minute
        const decimal MaxOffer = 1000000m;     // largest offer accepted
        const int PageSize = 200;              // messages returned by one request
 
        /// <summary>
        /// My conversations, newest activity first
        /// </summary>
        /// <param name="auth">Input: {app_access, access_token}</param>
        [HttpGet]
        public IActionResult GetConversations(AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            if (msg != null) return msg;
 
            // A forwarded (impersonated) user cannot read someone else's messages
            if (user.forwarded)
                return BadRequest(new { Message = "User cannot be forwarded." });
 
            try
            {
                var result = Sql.Read(
                    @"SELECT c.id, c.listing_id, c.buyer_id, c.seller_id, l.title, 
                    (SELECT i.name FROM Img i WHERE i.list_id=c.listing_id ORDER BY i.id LIMIT 1) image,
                    ub.first_name buyer_first, ub.last_name buyer_last, 
                    us.first_name seller_first, us.last_name seller_last, 
                    m.kind last_kind, m.body last_body, m.amount last_amount, 
                    m.datetime last_datetime, m.sender_id last_sender_id, 
                    (SELECT COUNT(*) FROM Messages x WHERE x.conversation_id = c.id 
                    AND x.sender_id <> @me AND x.read_datetime IS NULL) unread 
                    FROM Conversations c 
                    JOIN Listings l ON l.id = c.listing_id 
                    JOIN User ub ON ub.id = c.buyer_id 
                    JOIN User us ON us.id = c.seller_id 
                    JOIN Messages m ON m.id = (SELECT MAX(id) FROM Messages WHERE conversation_id = c.id) 
                    WHERE c.buyer_id = @me OR c.seller_id = @me 
                    ORDER BY m.id DESC",
                    new Dictionary<string, object> { { "@me", user.id } });
 
                // Sql.Read returns columns; rebuild one object per conversation
                var conversations = new List<object>();
                if (result.Count > 0)
                {
                    for (int i = 0; i < result["id"].Count; i++)
                    {
                        var iAmBuyer = (long)result["buyer_id"][i] == user.id;
                        var otherName = iAmBuyer
                            ? $"{result["seller_first"][i]} {result["seller_last"][i]}"
                            : $"{result["buyer_first"][i]} {result["buyer_last"][i]}";
 
                        var image = Val(result["image"][i]) as string;
                        var preview = Val(result["last_body"][i]) as string ?? "";
                        if (preview.Length > 80) preview = preview[..80] + "...";
                        var amount = Val(result["last_amount"][i]);
 
                        conversations.Add(new
                        {
                            id = (long)result["id"][i],
                            listing_id = (long)result["listing_id"][i],
                            listing_title = result["title"][i],
                            image_url = image == null ? null : "/uploads/" + image,
                            role = iAmBuyer ? "buyer" : "seller",
                            other_name = otherName,
                            last_kind = result["last_kind"][i],
                            last_text = preview,
                            last_amount = amount == null ? (decimal?)null : Convert.ToDecimal(amount),
                            last_datetime = result["last_datetime"][i],
                            last_from_me = (long)result["last_sender_id"][i] == user.id,
                            unread = (long)result["unread"][i]
                        });
                    }
                }
                return Ok(conversations);
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }
 
        /// <summary>
        /// Number of unread messages sent to me
        /// </summary>
        /// <param name="auth">Input: {app_access, access_token}</param>
        [HttpGet("unread")]
        public IActionResult GetUnread(AppAuthJson auth)
        {
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            if (msg != null) return msg;
 
            if (user.forwarded)
                return BadRequest(new { Message = "User cannot be forwarded." });
 
            try
            {
                var result = Sql.Read(
                    @"SELECT COUNT(*) n FROM Messages m 
                    JOIN Conversations cv ON cv.id = m.conversation_id 
                    WHERE (cv.buyer_id = @me OR cv.seller_id = @me) 
                    AND m.sender_id <> @me AND m.read_datetime IS NULL",
                    new Dictionary<string, object> { { "@me", user.id } });
 
                return Ok(new { unread = (long)result["n"][0] });
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }
 
        /// <summary>
        /// Messages of one conversation, oldest first.
        /// Use ?after=&lt;last message id you have&gt; to get only newer ones.
        /// </summary>
        /// <param name="conversationId">Conversation id</param>
        /// <param name="auth">Input: {app_access, access_token}</param>
        /// <param name="after">Only messages with an id greater than this</param>
        [HttpGet("{conversationId:long}")]
        public IActionResult GetMessages(long conversationId, AppAuthJson auth, [FromQuery] long after = 0)
        {
            var msg = AppAuthJson.ValidateWithToken(this, auth, HttpContext, out var user, out var ip);
            if (msg != null) return msg;
 
            if (user.forwarded)
                return BadRequest(new { Message = "User cannot be forwarded." });
 
            try
            {
                // Only the buyer and the seller may read it. Anyone else gets the same
                // "not found" as a conversation that doesn't exist.
                var conv = Sql.Read("SELECT buyer_id, seller_id FROM Conversations WHERE [id]=@id",
                    new Dictionary<string, object> { { "@id", conversationId } });
                if (conv.Count == 0 || !IsParticipant(conv, user.id))
                    return NotFound(new { Message = "Conversation not found." });
 
                var result = Sql.Read(
                    @"SELECT id, sender_id, kind, body, amount, datetime, read_datetime 
                    FROM Messages WHERE conversation_id = @c AND id > @after " +
                    $"ORDER BY id LIMIT {PageSize}",
                    new Dictionary<string, object> { { "@c", conversationId }, { "@after", after } });
 
                var messages = new List<object>();
                if (result.Count > 0)
                {
                    for (int i = 0; i < result["id"].Count; i++)
                    {
                        var amount = Val(result["amount"][i]);
                        messages.Add(new
                        {
                            id = (long)result["id"][i],
                            mine = (long)result["sender_id"][i] == user.id,
                            kind = result["kind"][i],
                            text = Val(result["body"][i]),
                            amount = amount == null ? (decimal?)null : Convert.ToDecimal(amount),
                            datetime = result["datetime"][i],
                            read = Val(result["read_datetime"][i]) != null
                        });
                    }
 
                    // Opening the conversation marks the other person's messages as read.
                    // -2: zero rows is fine (nothing was unread).
                    Sql.Write(@"UPDATE Messages SET read_datetime=@now 
                              WHERE conversation_id=@c AND sender_id<>@me AND read_datetime IS NULL",
                        new Dictionary<string, object>
                        {
                            { "@now", Utilz.ToMtn().ToString("s") },
                            { "@c", conversationId },
                            { "@me", user.id }
                        }, -2);
                }
 
                return Ok(new { conversation_id = conversationId, messages });
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }
 
        /// <summary>
        /// Send a message or an offer
        /// </summary>
        /// <param name="model">Input: {app_access, access_token, listing_id || conversation_id, kind?, text?, amount?}</param>
        [HttpPost]
        public IActionResult SendMessage([FromBody] MessageSendModel model)
        {
            var msg = AppAuthJson.ValidateWithToken(this, model, HttpContext, out var user, out var ip);
            if (msg != null) return msg;
 
            if (user.forwarded)
                return BadRequest(new { Message = "User cannot be forwarded." });
 
            // Validate everything before touching the database
            var kind = (model.kind ?? "message").Trim().ToLowerInvariant();
            if (kind != "message" && kind != "offer")
                return BadRequest(new { Message = "kind must be 'message' or 'offer'." });
 
            var text = (model.text ?? "").Trim();
            if (text.Length > MaxTextLength)
                return BadRequest(new { Message = $"Text is too long (max {MaxTextLength} characters)." });
 
            decimal? amount = null;
            if (kind == "message")
            {
                if (text.Length == 0)
                    return BadRequest(new { Message = "Message text is required." });
            }
            else
            {
                if (model.amount == null || model.amount <= 0 || model.amount > MaxOffer)
                    return BadRequest(new { Message = $"An offer needs an amount greater than 0 and at most {MaxOffer:0}." });
                amount = Math.Round(model.amount.Value, 2);
            }
 
            if (model.conversation_id == null && model.listing_id == null)
                return BadRequest(new { Message = "Specify listing_id or conversation_id." });
 
            try
            {
                // Flood limit: stops a script from filling the database
                var recent = Sql.Read("SELECT COUNT(*) n FROM Messages WHERE sender_id=@me AND datetime>@since",
                    new Dictionary<string, object>
                    {
                        { "@me", user.id },
                        { "@since", Utilz.ToMtn().AddMinutes(-1).ToString("s") }
                    });
                if ((long)recent["n"][0] >= MaxPerMinute)
                    return StatusCode(429, new { Message = "You are sending messages too quickly. Please wait a minute." });
 
                long conversationId;
                if (model.conversation_id != null)
                {
                    // Continue an existing conversation: only its two people may write in it
                    var conv = Sql.Read("SELECT buyer_id, seller_id FROM Conversations WHERE [id]=@id",
                        new Dictionary<string, object> { { "@id", model.conversation_id.Value } });
                    if (conv.Count == 0 || !IsParticipant(conv, user.id))
                        return NotFound(new { Message = "Conversation not found." });
                    conversationId = model.conversation_id.Value;
                }
                else
                {
                    // Start (or reuse) the conversation between me, the buyer, and the listing's owner
                    var listing = Sql.Read("SELECT [user_id] FROM Listings WHERE [id]=@id",
                        new Dictionary<string, object> { { "@id", model.listing_id!.Value } });
                    if (listing.Count == 0)
                        return NotFound(new { Message = "Listing not found." });
 
                    var sellerId = (long)listing["user_id"][0];
                    if (sellerId == user.id)
                        return BadRequest(new { Message = "You cannot message yourself about your own listing." });
 
                    conversationId = FindOrCreateConversation(model.listing_id.Value, user.id, sellerId);
                }
 
                Sql.Write(@"INSERT INTO Messages (conversation_id, sender_id, kind, body, amount, datetime) 
                          VALUES (@c, @s, @k, @b, @a, @d)",
                    new Dictionary<string, object>
                    {
                        { "@c", conversationId },
                        { "@s", user.id },                                   // from the token, not the client
                        { "@k", kind },
                        // SQLite needs DBNull.Value (not null) to store an empty cell
                        { "@b", (object?)(text.Length == 0 ? null : text) ?? DBNull.Value },
                        { "@a", (object?)amount ?? DBNull.Value },
                        { "@d", Utilz.ToMtn().ToString("s") }
                    }, 1);
 
                return StatusCode(201, new
                {
                    Message = kind == "offer" ? "Offer sent." : "Message sent.",
                    conversation_id = conversationId
                });
            }
            catch (Exception e)
            {
                return StatusCode(500, new { Message = $"An internal server error occurred: {e}" });
            }
        }
 
        /// <summary>
        /// Occasionally should be used to clean up resources.
        /// The database does not enforce foreign keys, so when a listing or user is deleted their
        /// conversations and messages stay behind. This removes them.
        /// </summary>
        public static void CleanUp()
        {
            // !!! This is not needed foreign keys are already setup for CASCADE for Update & Delete. !!!

            //Sql.Write("DELETE FROM Conversations WHERE [listing_id] NOT IN (SELECT [id] FROM Listings) " +
            //          "OR [buyer_id] NOT IN (SELECT [id] FROM User) " +
            //          "OR [seller_id] NOT IN (SELECT [id] FROM User)", null, -2);
 
            //Sql.Write("DELETE FROM Messages WHERE [conversation_id] NOT IN (SELECT [id] FROM Conversations)",
            //    null, -2);
        }
 
        // ---------------- Helpers ----------------
 
        // The database gives DBNull for empty cells; turn that into a normal null
        static object? Val(object o) => o is DBNull ? null : o;
 
        // Is this user the buyer or the seller of the conversation?
        static bool IsParticipant(Dictionary<string, List<object>> conv, long userId)
            => (long)conv["buyer_id"][0] == userId || (long)conv["seller_id"][0] == userId;
 
        /// <summary>
        /// Finds the conversation for (listing, buyer), creating it if needed.
        /// If two requests create it at the same moment, the unique index rejects the second
        /// insert; we then just read the one that won.
        /// </summary>
        static long FindOrCreateConversation(long listingId, long buyerId, long sellerId)
        {
            var key = new Dictionary<string, object> { { "@l", listingId }, { "@b", buyerId } };
 
            for (int i = 0; i < 2; i++)
            {
                var found = Sql.Read("SELECT [id] FROM Conversations WHERE [listing_id]=@l AND [buyer_id]=@b", key);
                if (found.Count != 0) return (long)found["id"][0];
 
                try
                {
                    Sql.Write(@"INSERT INTO Conversations (listing_id, buyer_id, seller_id, datetime) 
                              VALUES (@l, @b, @s, @d)",
                        new Dictionary<string, object>
                        {
                            { "@l", listingId },
                            { "@b", buyerId },
                            { "@s", sellerId },
                            { "@d", Utilz.ToMtn().ToString("s") }
                        }, 1);
                }
                catch (SqliteException e) when (e.SqliteErrorCode == 19)   // 19 = constraint (unique) violation
                {
                    // Another request created it first: loop and read it
                }
            }
            throw new Exception("The conversation could not be created.");
        }
    }
 
    public class MessageSendModel : AppAuthJson
    {
        public long? listing_id { get; set; }          // start a conversation about this listing
        public long? conversation_id { get; set; }     // or continue this one
        public string? kind { get; set; }              // 'message' (default) or 'offer'
        public string? text { get; set; }
        public decimal? amount { get; set; }           // offers only
    }
}