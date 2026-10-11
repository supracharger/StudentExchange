using Microsoft.Extensions.Diagnostics.HealthChecks;
using Newtonsoft.Json;

/* Enviroment Object: containing secrets & Settings. */

namespace StudentExchangeBck
{
    public static class Env
    {
        // Application Access Password
        public static string _appAccess { get; private set; } = null!;
        // Email Password Encryption
        public static string _emailSalt { get; private set; } = null!;
        // Password Encryption
        public static string _passSalt { get; private set; } = null!;
        // IP Encryption
        public static string _ipSalt { get; private set; } = null!;
        // Admin Token
        //public static string _adminToken { get; private set; } = null!;

        // When the Access token expires
        public static readonly TimeSpan _tokenExpiry = new TimeSpan(days: 21, 0, 0, 0);
        // When the Admin Access token expires
        public static readonly TimeSpan _tokenExpiryAdmin = new TimeSpan(days: 3, 0, 0, 0);
        // After unsuccessfull attemps, timeout client is blocked
        public static readonly TimeSpan _blockedAccessTimeOut = new TimeSpan(0, minutes: 5, 0);
        // After unsuccessfull attemps by IP, timeout client is blocked
        public static readonly TimeSpan _blockedAccessTimeOutIP = new TimeSpan(0, minutes: 5, 0);
        // Number of unsuccessfull attemps before blocked timeout.
        public static readonly int _accessAttemps = 10;
        // Number of unsuccessfull IP attemps before blocked timeout.
        public static readonly int _accessAttempsIP = 10;

        public static string _bin { get; private set; }

        /// <summary>
        /// Get Enviroment from file
        /// </summary>
        /// <param name="salt">Temporary extra security password</param>
        /// <exception cref="Exception"></exception>
        public static void GetEnv(string salt = "tempPass!^74*")
        {
            // Get Bin Path to Files
            _bin = File.ReadAllText("path.env").Split('\n', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Split('=')).Where(s => s.Length != 2)
                        .ToDictionary(s => s[0].Trim(), s => s[1].Trim())
                        ["path"];

            string path = _bin + ".env";

            // Read in Encypted env
            var env = System.IO.File.ReadAllText(path);
            // Decrypt
            env = DeterministicEncryption.Decrypt(env, salt);
            // Convert to dictionary object
            var d = JsonConvert.DeserializeObject<Dictionary<string, string>>(env)!
                        .ToDictionary(s => s.Key, s => s.Value.Trim());
            // Get values
            _appAccess = d["_appAccess"];
            _emailSalt = d["_emailSalt"];
            _passSalt = d["_passSalt"];
            _ipSalt = d["_ipSalt"];
            //_adminToken = d["_adminToken"];

            // Validate Members
            if (_tokenExpiry.TotalDays <= 1)
                throw new Exception("Login needs expiry larger than 1 day.");
            if (_accessAttemps <= 1)
                throw new Exception("Login needs access attemps >1.");
        }
    }
}
