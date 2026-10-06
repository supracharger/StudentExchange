namespace StudentExchangeBck
{
    public class User
    {
        public struct Data
        {
            public readonly long id = -1;
            public readonly bool isAdmin, forwarded;

            public Data(long id, bool isAdmin = false, bool forwarded = false)
            {
                this.id = id;
                this.isAdmin = isAdmin;
                this.forwarded = forwarded;
            }
        }
    }
}
