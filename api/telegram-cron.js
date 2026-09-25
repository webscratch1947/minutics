// Daily-report cron trigger — placeholder during plan probe; replaced by the
// full scheduler in the follow-up deploy.
export default async function handler(req, res) {
  const schedule = req.headers["x-vercel-cron-schedule"] || "";
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  res.status(200).json({ ok: true, schedule });
}
