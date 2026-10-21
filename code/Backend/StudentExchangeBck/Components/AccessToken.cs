using System.Security.Cryptography;//import for RandomNumberGenerator
//AccessToken has one job generate a random hard to guess string that the backend can use a login token
namespace StudentExchangeBck{
    public static class AccessToken{
        public static string Generate()
        {
            byte[] bytes = RandomNumberGenerator.GetBytes(32);//creates 32 random bytes (256 bits of randomness)

            return Convert.ToBase64String(bytes)//turns bytes into letters and numbers, + and / and = are for padding
                .Replace("+", "-") //swap chars
                .Replace("/", "_")
                .TrimEnd('='); //removes = padding at the end, bc it is awkward in URLs
        }
    }
}