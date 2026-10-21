/* Daily alarm clock. you give it a time of day and a method, and it runs that method everyday at the time own its own background thread */

namespace StudentExchangeBck{
    public class Maitenance : IDisposable{
        readonly AutoResetEvent _evt;
        readonly Thread _thread;
        volatile bool _abortThread;
        // Time to run maitenance
        readonly TimeSpan _time;
        // Task to run at time
        readonly Action _RunTask;

    public Maitenance(int time, Action Task){//takes time in HHMM form, throws error if time is 0 or less 2400 or more. splits the num into hours and mins, creates the signal and the thread
            // Validate & save time
            if (time <= 0 || time >= 2400) throw new ArgumentException("time <= 0 || time >= 2400");
            (var hour, var min) = (time / 100, time % 100);
            if (min >= 60) throw new ArgumentException("min >= 60");
            _time = new TimeSpan(hour, min, 0);

            //async worker thread
            _RunTask = Task;
            _evt = new AutoResetEvent(false);
            _thread = new Thread(Worker);
            _thread.Name = "Maitenance-Worker";
            _thread.Start();
        }

        public void Worker(){//gets the current MTN time and builds today the run time, if moment passed moved to tmrw, calc how long til then
            while (true)
            {
                // Find time to wait until specified next time
                var now = Utilz.ToMtn();
                DateTime nextDate = new DateTime(now.Year, now.Month, now.Day, _time.Hours, _time.Minutes, 0);
                while (nextDate.Subtract(now).TotalDays <= 0)
                    nextDate = nextDate.AddDays(1);
                var wait = nextDate.Subtract(Utilz.ToMtn());

                // Wait specified time or Event is signaled
                _evt.WaitOne(wait);
                // Exit: if abort
                if (_abortThread) return;

                // Run Task
                try { _RunTask(); }
                catch (Exception e) { Console.WriteLine(e); }
            }
        }

        public void Dispose(){//sets _abourtThread to ture, and signals _evt so sleeping worker wakes up sees flag and exits
            _abortThread = true;
            _evt.Set();
        }
    }
}